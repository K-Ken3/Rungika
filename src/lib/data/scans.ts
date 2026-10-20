import "server-only";

import { ScanJobStatus, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  assertOperationalBusinessAccess,
  BusinessValidationError,
  requireOperationalBusinessAccess,
} from "@/lib/data/business";
import { UNCERTAIN_CONFIDENCE_THRESHOLD } from "@/lib/ocr/normalize";

export type ScanCellDTO = {
  value: string;
  confidence: number | null;
  uncertain: boolean;
  note: string | null;
};

export type ScanColumnDTO = {
  label: string;
  confidence: number | null;
};

export type ScanResultDTO = {
  title: string | null;
  provider: string;
  columns: ScanColumnDTO[];
  rows: ScanCellDTO[][];
  warnings: string[];
  rawText: string | null;
};

export type ScanJobDTO = {
  id: string;
  status: ScanJobStatus;
  provider: string | null;
  sourceName: string | null;
  sourceMime: string | null;
  hint: string | null;
  error: string | null;
  importedTableId: string | null;
  createdAt: string;
  result: ScanResultDTO | null;
};

export type ScanImportTargetDTO = {
  id: string;
  name: string;
  fields: Array<{ key: string; label: string; type: string; required: boolean }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseResult(value: unknown, fallbackProvider: string | null): ScanResultDTO | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const rawColumns = Array.isArray(record.columns) ? record.columns : [];
  const columns: ScanColumnDTO[] = rawColumns.map((column, index) => {
    const entry = asRecord(column);
    return {
      label: text(entry?.label) || `Column ${index + 1}`,
      confidence: numberOrNull(entry?.confidence),
    };
  });
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  const rows: ScanCellDTO[][] = rawRows.map((row) => {
    const entry = asRecord(row);
    const cells = entry && Array.isArray(entry.cells) ? entry.cells : Array.isArray(row) ? row : [];
    return cells.map((cell) => {
      const cellRecord = asRecord(cell);
      const confidence = numberOrNull(cellRecord?.confidence);
      const cellValue = text(cellRecord?.value ?? cell);
      return {
        value: cellValue,
        confidence,
        uncertain:
          cellRecord?.uncertain === true ||
          (confidence !== null && confidence < UNCERTAIN_CONFIDENCE_THRESHOLD),
        note: text(cellRecord?.note) || null,
      };
    });
  });
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.map((entry) => text(entry)).filter((entry) => entry.length > 0)
    : [];
  return {
    title: text(record.title) || null,
    provider: text(record.provider) || fallbackProvider || "unknown",
    columns,
    rows,
    warnings,
    rawText: text(record.rawText) || null,
  };
}

function toJobDTO(job: {
  id: string;
  status: ScanJobStatus;
  provider: string | null;
  sourceName: string | null;
  sourceMime: string | null;
  hint: string | null;
  error: string | null;
  importedTableId: string | null;
  createdAt: Date;
  result: Prisma.JsonValue | null;
  warnings: Prisma.JsonValue | null;
}): ScanJobDTO {
  const result = parseResult(job.result, job.provider);
  if (result && Array.isArray(job.warnings)) {
    const extra = job.warnings
      .map((entry) => text(entry))
      .filter((entry) => entry.length > 0);
    result.warnings = [...result.warnings, ...extra];
  }
  return {
    id: job.id,
    status: job.status,
    provider: job.provider,
    sourceName: job.sourceName,
    sourceMime: job.sourceMime,
    hint: job.hint,
    error: job.error,
    importedTableId: job.importedTableId,
    createdAt: job.createdAt.toISOString(),
    result,
  };
}

const JOB_SELECT = {
  id: true,
  status: true,
  provider: true,
  sourceName: true,
  sourceMime: true,
  hint: true,
  error: true,
  importedTableId: true,
  createdAt: true,
  result: true,
  warnings: true,
} as const;

export async function createScanJob(input: {
  userId: string;
  businessId: string;
  provider: string;
  sourceKey: string;
  sourceName: string;
  sourceMime: string;
  hint?: string | null;
}): Promise<ScanJobDTO> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");

  const job = await db.scanJob.create({
    data: {
      businessId: input.businessId,
      createdById: input.userId,
      status: ScanJobStatus.PROCESSING,
      provider: input.provider,
      sourceKey: input.sourceKey,
      sourceName: input.sourceName,
      sourceMime: input.sourceMime,
      hint: input.hint ?? null,
    },
    select: JOB_SELECT,
  });

  await db.auditLog.create({
    data: {
      businessId: input.businessId,
      actorId: input.userId,
      action: "SCAN.STARTED",
      entityType: "ScanJob",
      entityId: job.id,
      metadata: { provider: input.provider, sourceName: input.sourceName },
    },
  });

  return toJobDTO(job);
}

export async function completeScanJob(input: {
  userId: string;
  businessId: string;
  scanJobId: string;
  result: unknown;
  warnings: string[];
  provider: string;
}): Promise<void> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");
  const updated = await db.scanJob.updateMany({
    where: { id: input.scanJobId, businessId: input.businessId },
    data: {
      status: ScanJobStatus.REVIEW,
      result: input.result as Prisma.InputJsonValue,
      warnings: input.warnings as Prisma.InputJsonValue,
      provider: input.provider,
      error: null,
    },
  });
  if (updated.count === 0) {
    throw new BusinessValidationError("That scan could not be found.");
  }
  await db.auditLog.create({
    data: {
      businessId: input.businessId,
      actorId: input.userId,
      action: "SCAN.COMPLETED",
      entityType: "ScanJob",
      entityId: input.scanJobId,
      metadata: { provider: input.provider, warnings: input.warnings.length },
    },
  });
}

export async function failScanJob(input: {
  userId: string;
  businessId: string;
  scanJobId: string;
  error: string;
}): Promise<void> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");
  await db.scanJob.updateMany({
    where: { id: input.scanJobId, businessId: input.businessId },
    data: { status: ScanJobStatus.FAILED, error: input.error.slice(0, 2000) },
  });
  await db.auditLog.create({
    data: {
      businessId: input.businessId,
      actorId: input.userId,
      action: "SCAN.FAILED",
      entityType: "ScanJob",
      entityId: input.scanJobId,
      metadata: { reason: input.error.slice(0, 500) },
    },
  });
}

export async function saveScanEdits(input: {
  userId: string;
  businessId: string;
  scanJobId: string;
  result: unknown;
}): Promise<void> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");
  const updated = await db.scanJob.updateMany({
    where: { id: input.scanJobId, businessId: input.businessId, status: ScanJobStatus.REVIEW },
    data: { result: input.result as Prisma.InputJsonValue },
  });
  if (updated.count === 0) {
    throw new BusinessValidationError("That scan is no longer editable.");
  }
}

export async function markScanJobImported(input: {
  userId: string;
  businessId: string;
  scanJobId: string;
  tableId: string;
}): Promise<void> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.create");
  await db.scanJob.updateMany({
    where: { id: input.scanJobId, businessId: input.businessId },
    data: { status: ScanJobStatus.IMPORTED, importedTableId: input.tableId },
  });
}

export async function getScanJob(
  userId: string,
  businessId: string,
  scanJobId: string,
): Promise<ScanJobDTO> {
  await requireOperationalBusinessAccess(userId, businessId, "tables.view");
  const job = await db.scanJob.findFirst({
    where: { id: scanJobId, businessId },
    select: JOB_SELECT,
  });
  if (!job) {
    throw new BusinessValidationError("That scan could not be found.");
  }
  return toJobDTO(job);
}

export async function listScanJobs(userId: string, businessId: string): Promise<ScanJobDTO[]> {
  await requireOperationalBusinessAccess(userId, businessId, "tables.view");
  const jobs = await db.scanJob.findMany({
    where: { businessId, status: { not: ScanJobStatus.FAILED } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: JOB_SELECT,
  });
  return jobs.map((job) => toJobDTO(job));
}

export async function getScanImportTargets(
  userId: string,
  businessId: string,
): Promise<ScanImportTargetDTO[]> {
  await requireOperationalBusinessAccess(userId, businessId, "tables.view");
  const tables = await db.customTable.findMany({
    where: { businessId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      fields: {
        orderBy: { position: "asc" },
        select: { key: true, label: true, type: true, required: true },
      },
    },
  });
  return tables.map((table) => ({
    id: table.id,
    name: table.name,
    fields: table.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
    })),
  }));
}
