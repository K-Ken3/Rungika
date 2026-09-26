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
} from "@/lib/security/csv";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { RATE_LIMIT_ACTIONS } from "@/lib/security/rate-limit-rules";

export const dynamic = "force-dynamic";

export const MAX_EXPORT_PAGE_SIZE = 500;
export const MAX_EXPORT_ROWS = MAX_EXPORT_PAGE_SIZE;
export const MAX_EXPORT_FIELDS = 200;
const MAX_EXPORT_PAGE = 100_000;

type ExportStatus = "ACTIVE" | "ARCHIVED" | "all";

function isValidTableId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/u.test(value);
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
  if (page === null || pageSize === null || status === null) {
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
  const skip = (page - 1) * pageSize;
  let records;
  let total;
  try {
    [records, total] = await Promise.all([
      db.customRecord.findMany({
        where: recordWhere,
        select: {
          id: true,
          status: true,
          data: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      db.customRecord.count({ where: recordWhere }),
    ]);
  } catch {
    return errorResponse(503, "Unable to process request");
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
  const rows = records.map((record) => {
    const metadata = [
      record.id,
      record.status,
      record.createdAt,
      record.updatedAt,
      record.archivedAt,
    ];
    return [
      ...metadata,
      ...fieldColumns.map((field) => getJsonRecordValue(record.data, field.key)),
    ];
  });
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
      "X-Export-Total-Count": String(total),
    },
  });
  return new Response(body, responseInit);
}
