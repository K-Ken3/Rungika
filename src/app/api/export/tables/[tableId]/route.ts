import { getBusinessPermissionKeys, hasBusinessPermission } from "@/lib/auth/authorization";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visibleFieldKeys } from "@/lib/permissions";
import {
  errorResponse,
  hasActiveBusinessMembership,
  hasOperationalBusinessState,
  rateLimitResponse,
  requestRateLimitIdentifier,
  withSecurityHeaders,
} from "@/lib/security/api";
import {
  CSV_CONTENT_TYPE,
  contentDispositionAttachment,
  getJsonRecordValue,
  safeDownloadFilename,
  serializeCsv,
  XLSX_CONTENT_TYPE,
} from "@/lib/security/csv";
import { buildXlsxBuffer } from "@/lib/spreadsheet/xlsx";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/security/rate-limit-rules";

export const dynamic = "force-dynamic";

export const MAX_EXPORT_PAGE_SIZE = 500;
export const MAX_EXPORT_ROWS = MAX_EXPORT_PAGE_SIZE;
export const MAX_EXPORT_FIELDS = 200;
export const MAX_EXPORT_ALL_ROWS = 50_000;
const MAX_EXPORT_PAGE = 100_000;
const EXPORT_CHUNK_SIZE = 1_000;

type ExportStatus = "ACTIVE" | "ARCHIVED" | "all";

function isValidTableId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/u.test(value);
}

type ExportFormat = "csv" | "xlsx";

function parseFormat(value: string | null): ExportFormat | null {
  if (value === null || value === "csv") {
    return "csv";
  }
  return value === "xlsx" ? "xlsx" : null;
}

function parseScope(value: string | null): "page" | "all" | null {
  if (value === null || value === "page") {
    return "page";
  }
  return value === "all" ? "all" : null;
}

function parsePage(value: string | null): number | null {
  if (value === null) {
    return 1;
  }
  if (!/^[1-9][0-9]*$/u.test(value)) {
    return null;
  }
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_EXPORT_PAGE ? page : null;
}

function parsePageSize(value: string | null): number | null {
  if (value === null) {
    return 100;
  }
  if (!/^[1-9][0-9]*$/u.test(value)) {
    return null;
  }
  const pageSize = Number(value);
  return Number.isSafeInteger(pageSize) && pageSize <= MAX_EXPORT_PAGE_SIZE ? pageSize : null;
}

function parseStatus(value: string | null): ExportStatus | null {
  if (value === null || value === "all") {
    return "all";
  }
  if (value === "ACTIVE" || value === "ARCHIVED") {
    return value;
  }
  return null;
}

function uniqueHeader(preferred: string, used: Set<string>): string {
  const base = preferred.trim() || "column";
  let header = base;
  let suffix = 2;
  while (used.has(header.toLowerCase())) {
    header = `${base} (${suffix})`;
    suffix += 1;
  }
  used.add(header.toLowerCase());
  return header;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
): Promise<Response> {
  const { tableId } = await params;
  if (!isValidTableId(tableId)) {
    return errorResponse(404, "Table not found");
  }

  const searchParams = new URL(request.url).searchParams;
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const status = parseStatus(searchParams.get("status"));
  const format = parseFormat(searchParams.get("format"));
  const scope = parseScope(searchParams.get("scope"));
  if (page === null || pageSize === null || status === null || format === null || scope === null) {
    return errorResponse(400, "Invalid export parameters");
  }

  let session;
  try {
    session = await getCurrentSession();
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!session) {
    return errorResponse(401, "Authentication required");
  }

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit(
      RATE_LIMIT_ACTIONS.TABLE_EXPORT,
      requestRateLimitIdentifier(request, session.userId),
    );
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  let table;
  try {
    table = await db.customTable.findUnique({
      where: { id: tableId },
      select: {
        id: true,
        businessId: true,
        name: true,
        slug: true,
        fields: {
          select: {
            key: true,
            label: true,
            position: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
          orderBy: { position: "asc" },
        },
        business: {
          select: {
            status: true,
            adminHold: true,
            subscription: { select: { status: true } },
          },
        },
      },
    });
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  if (!table) {
    return errorResponse(404, "Table not found");
  }

  if (!hasActiveBusinessMembership(session.user, table.businessId)) {
    return errorResponse(404, "Table not found");
  }
  if (!hasOperationalBusinessState({
    businessStatus: table.business.status,
    subscriptionStatus: table.business.subscription?.status,
    adminHold: table.business.adminHold,
  })) {
    return errorResponse(404, "Table not found");
  }
  try {
    if (!(await hasBusinessPermission(session.userId, table.businessId, "records.export"))) {
      return errorResponse(404, "Table not found");
    }
  } catch {
    return errorResponse(503, "Unable to process request");
  }

  const recordWhere = {
    tableId: table.id,
    businessId: table.businessId,
    ...(status === "all" ? {} : { status }),
  };
  const recordSelect = {
    id: true,
    status: true,
    data: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
  } as const;
  const recordOrderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];
  const takeAll = scope === "all";
  const skip = takeAll ? 0 : (page - 1) * pageSize;
  const take = takeAll ? Math.min(MAX_EXPORT_ALL_ROWS, EXPORT_CHUNK_SIZE) : pageSize;
  let records;
  let total;
  try {
    const [firstChunk, count] = await Promise.all([
      db.customRecord.findMany({
        where: recordWhere,
        select: recordSelect,
        orderBy: recordOrderBy,
        skip,
        take,
      }),
      db.customRecord.count({ where: recordWhere }),
    ]);
    records = firstChunk;
    total = count;
    if (takeAll && count > firstChunk.length) {
      for (let offset = firstChunk.length; offset < Math.min(count, MAX_EXPORT_ALL_ROWS); offset += EXPORT_CHUNK_SIZE) {
        const chunk = await db.customRecord.findMany({
          where: recordWhere,
          select: recordSelect,
          orderBy: recordOrderBy,
          skip: offset,
          take: Math.min(EXPORT_CHUNK_SIZE, Math.min(count, MAX_EXPORT_ALL_ROWS) - offset),
        });
        if (chunk.length === 0) {
          break;
        }
        records = records.concat(chunk);
      }
    }
  } catch {
    return errorResponse(503, "Unable to process request");
  }
  const truncated = total > records.length;
  if (takeAll) {
    total = records.length;
  }

  let exportPermissionKeys: string[] = [];
  try {
    exportPermissionKeys = await getBusinessPermissionKeys(
      session.userId,
      table.businessId,
    );
  } catch {
    return errorResponse(503, "Unable to process request");
  }

  const allowedFieldKeys = visibleFieldKeys(
    table.fields.map((field) => ({
      key: field.key,
      allowedPermissionKeys: field.permissions.map((entry) => entry.permission.key),
    })),
    exportPermissionKeys,
  );

  const usedHeaders = new Set<string>();
  const metadataColumns = [
    { key: "id", header: uniqueHeader("id", usedHeaders) },
    { key: "status", header: uniqueHeader("status", usedHeaders) },
    { key: "createdAt", header: uniqueHeader("createdAt", usedHeaders) },
    { key: "updatedAt", header: uniqueHeader("updatedAt", usedHeaders) },
    { key: "archivedAt", header: uniqueHeader("archivedAt", usedHeaders) },
  ];
  const fieldColumns = table.fields
    .filter((field) => allowedFieldKeys.has(field.key))
    .map((field) => ({
      key: field.key,
      header: uniqueHeader(field.label || field.key, usedHeaders),
    }));
  const columns = [...metadataColumns, ...fieldColumns];
  if (columns.length > MAX_EXPORT_FIELDS) {
    return errorResponse(400, "This table has too many fields to export");
  }
  const rows = records.map((record) => [
    record.id,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.archivedAt,
    ...fieldColumns.map((field) => getJsonRecordValue(record.data, field.key)),
  ]);

  if (format === "xlsx") {
    try {
      const sheetName = safeDownloadFilename(
        table.slug || table.name || "table export",
        "table export",
      )
        .replace(/\.[A-Za-z0-9]{1,10}$/u, "")
        .slice(0, 31);
      const xlsxBody = await buildXlsxBuffer({
        sheetName: sheetName.length > 0 ? sheetName : "Export",
        headers: columns.map((column) => column.header),
        rows,
      });
      const xlsxFilename = safeDownloadFilename(
        `${table.slug || table.name || "table-export"}.xlsx`,
        "table-export.xlsx",
      );
      return new Response(
        new Uint8Array(xlsxBody),
        withSecurityHeaders({
          headers: {
            "Content-Type": XLSX_CONTENT_TYPE,
            "Content-Disposition": contentDispositionAttachment(xlsxFilename),
            "Content-Length": String(xlsxBody.byteLength),
            "X-Export-Row-Count": String(rows.length),
            "X-Export-Total-Count": String(total),
            "X-Export-Scope": scope,
            ...(truncated ? { "X-Export-Truncated": "true" } : {}),
          },
        }),
      );
    } catch {
      return errorResponse(503, "Unable to process request");
    }
  }

  const csv = serializeCsv(
    columns.map((column) => column.header),
    rows,
  );
  const body = `\uFEFF${csv}`;

  const filename = safeDownloadFilename(
    `${table.slug || table.name || "table-export"}.csv`,
    "table-export.csv",
  );
  const responseInit = withSecurityHeaders({
    headers: {
      "Content-Type": CSV_CONTENT_TYPE,
      "Content-Disposition": contentDispositionAttachment(filename),
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
      "X-Export-Page": String(page),
      "X-Export-Page-Size": String(pageSize),
      "X-Export-Row-Count": String(rows.length),
      "X-Export-Total-Count": String(total),
      "X-Export-Scope": scope,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
  return new Response(body, responseInit);
}
