"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/authorization";
import {
  assertOperationalBusinessAccess,
  BusinessAccessError,
  BusinessConflictError,
  BusinessRestrictionError,
  BusinessValidationError,
} from "@/lib/data/business";
import {
  completeScanJob,
  createScanJob,
  failScanJob,
  markScanJobImported,
  saveScanEdits,
} from "@/lib/data/scans";
import { getOcrProvider, isOcrConfigured, OcrNotConfiguredError, OcrProviderError } from "@/lib/ocr";
import { MAX_SCAN_BYTES, MAX_SCAN_COLUMNS, MAX_SCAN_ROWS } from "@/lib/ocr/limits";
import {
  importScanAsExistingTable,
  importScanAsNewTable,
} from "@/lib/scan/import";
import { removePrivateUpload, savePrivateUpload } from "@/lib/storage/private-upload";
import {
  isProofContentForMime,
  isSafeOriginalFilename,
  normalizeProofMimeType,
} from "@/lib/storage/private-upload-rules";

export type ScanActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

const MAX_CELL_LENGTH = 2000;

const reviewCellSchema = z.object({
  value: z.string().max(MAX_CELL_LENGTH).default(""),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
  uncertain: z.boolean().optional().default(false),
  note: z.string().max(500).nullable().optional().default(null),
});

const reviewColumnSchema = z.object({
  label: z.string().max(100).default(""),
  confidence: z.number().min(0).max(1).nullable().optional().default(null),
});

const reviewSchema = z.object({
  title: z.string().max(200).nullable().optional().default(null),
  columns: z.array(reviewColumnSchema).min(1).max(MAX_SCAN_COLUMNS),
  rows: z.array(z.array(reviewCellSchema)).max(MAX_SCAN_ROWS),
});

const saveEditsSchema = z.object({
  scanJobId: z.string().min(10).max(64),
  table: reviewSchema,
});

const importSchema = z
  .object({
    scanJobId: z.string().min(10).max(64),
    mode: z.enum(["NEW_TABLE", "EXISTING_TABLE"]),
    tableName: z.string().trim().max(100).optional(),
    targetTableId: z.string().min(10).max(64).optional(),
    mapping: z.record(z.string(), z.string()).default({}),
    table: reviewSchema,
  })
  .refine((value) => value.mode !== "EXISTING_TABLE" || Boolean(value.targetTableId), {
    message: "Choose a table to import into.",
    path: ["targetTableId"],
  });

function formText(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function encode(businessId: string) {
  return encodeURIComponent(businessId);
}

function actionError(error: unknown): ScanActionState {
  if (error instanceof OcrNotConfiguredError || error instanceof OcrProviderError) {
    return { status: "error", message: error.message };
  }
  if (
    error instanceof BusinessValidationError ||
    error instanceof BusinessAccessError ||
    error instanceof BusinessRestrictionError ||
    error instanceof BusinessConflictError
  ) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { status: "error", message: "The database rejected that request. Please try again." };
  }
  return { status: "error", message: "We couldn't complete that request. Please try again." };
}

function parseJsonPayload<T>(schema: z.ZodType<T>, raw: string): T {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new BusinessValidationError("The scan data was malformed. Reload the page and try again.");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BusinessValidationError("The scan data was invalid. Check the table and try again.");
  }
  return parsed.data;
}

function toReviewResult(table: z.infer<typeof reviewSchema>) {
  return {
    title: table.title ?? null,
    columns: table.columns.map((column) => ({ label: column.label, confidence: column.confidence ?? null })),
    rows: table.rows.map((row) => ({
      cells: row.map((cell) => ({
        value: cell.value,
        confidence: cell.confidence ?? null,
        uncertain: cell.uncertain ?? false,
        note: cell.note ?? null,
      })),
    })),
  };
}

export async function createScanAction(
  businessId: string,
  _previousState: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Take a photo or choose an image to scan." };
  }

  const hint = formText(formData, "hint").trim().slice(0, 300) || null;
  const user = await requireUser();

  try {
    await assertOperationalBusinessAccess(user.id, businessId, "tables.create");

    if (!isOcrConfigured()) {
      return {
        status: "error",
        message:
          "Scan to Table is not configured on this server yet. Add a vision provider key (see the setup notes) to enable scanning.",
      };
    }
    if (file.size > MAX_SCAN_BYTES) {
      return { status: "error", message: "That file is too large. Scan a single page or use a smaller photo." };
    }

    const mime = normalizeProofMimeType(file.type);
    if (!mime || !isSafeOriginalFilename(file.name)) {
      return { status: "error", message: "Upload a PNG, JPEG or WEBP photo, or a PDF." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isProofContentForMime(bytes, mime)) {
      return { status: "error", message: "That file did not look like a valid image or PDF." };
    }

    const saved = await savePrivateUpload(file);
    const provider = getOcrProvider();
    const job = await createScanJob({
      userId: user.id,
      businessId,
      provider: provider.name,
      sourceKey: saved.key,
      sourceName: saved.name,
      sourceMime: saved.mime,
      hint,
    });

    try {
      const table = await provider.extractTable({
        bytes,
        mime,
        filename: saved.name,
        hint: hint ?? undefined,
      });
      await completeScanJob({
        userId: user.id,
        businessId,
        scanJobId: job.id,
        result: {
          title: table.title,
          provider: table.provider,
          columns: table.columns,
          rows: table.rows,
          warnings: table.warnings,
          rawText: table.rawText,
        },
        warnings: table.warnings,
        provider: table.provider,
      });
    } catch (error) {
      const message =
        error instanceof OcrNotConfiguredError || error instanceof OcrProviderError
          ? error.message
          : "We couldn't read that document. Try a clearer, well-lit photo.";
      await failScanJob({ userId: user.id, businessId, scanJobId: job.id, error: message }).catch(
        () => undefined,
      );
      revalidatePath(`/business/${encode(businessId)}`, "layout");
      return {
        status: "error",
        message,
        redirectTo: `/business/${encode(businessId)}/scan/${job.id}`,
      };
    }

    revalidatePath(`/business/${encode(businessId)}`, "layout");
    return {
      status: "success",
      message: "Scan ready to review.",
      redirectTo: `/business/${encode(businessId)}/scan/${job.id}`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveScanEditsAction(
  businessId: string,
  _previousState: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const user = await requireUser();
  try {
    const payload = parseJsonPayload(saveEditsSchema, formText(formData, "payload"));
    await saveScanEdits({
      userId: user.id,
      businessId,
      scanJobId: payload.scanJobId,
      result: toReviewResult(payload.table),
    });
    revalidatePath(`/business/${encode(businessId)}/scan/${payload.scanJobId}`);
    return { status: "success", message: "Review saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function importScanAction(
  businessId: string,
  _previousState: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const user = await requireUser();
  try {
    const payload = parseJsonPayload(importSchema, formText(formData, "payload"));
    const rows = payload.table.rows.map((row) => row.map((cell) => cell.value));
    const columns = payload.table.columns.map((column) => ({ label: column.label }));

    const result =
      payload.mode === "EXISTING_TABLE"
        ? await importScanAsExistingTable({
            userId: user.id,
            businessId,
            tableId: payload.targetTableId!,
            mapping: payload.mapping,
            rows,
          })
        : await importScanAsNewTable({
            userId: user.id,
            businessId,
            tableName: payload.tableName?.trim() || "Scanned table",
            columns,
            rows,
          });

    await markScanJobImported({
      userId: user.id,
      businessId,
      scanJobId: payload.scanJobId,
      tableId: result.tableId,
    });

    await db.importJob.create({
      data: {
        businessId,
        createdById: user.id,
        scanJobId: payload.scanJobId,
        tableId: result.tableId,
        mode: payload.mode,
        mapping: payload.mapping as Prisma.InputJsonValue,
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        status: "COMPLETED",
      },
    });

    revalidatePath(`/business/${encode(businessId)}`, "layout");

    const skipped =
      result.skippedCount > 0
        ? ` ${result.skippedCount} row${result.skippedCount === 1 ? "" : "s"} skipped because required fields were missing.`
        : "";

    return {
      status: "success",
      message: `Imported ${result.createdCount} row${result.createdCount === 1 ? "" : "s"} into "${result.tableName}".${skipped}`,
      redirectTo: `/business/${encode(businessId)}/tables?table=${encode(result.tableId)}&saved=imported`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function discardScanAction(
  businessId: string,
  _previousState: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const user = await requireUser();
  try {
    const scanJobId = formText(formData, "scanJobId");
    const parsedId = z.string().min(10).max(64).safeParse(scanJobId);
    if (!parsedId.success) {
      return { status: "error", message: "That scan could not be found." };
    }
    await assertOperationalBusinessAccess(user.id, businessId, "tables.delete");
    const job = await db.scanJob.findFirst({
      where: { id: parsedId.data, businessId },
      select: { id: true, sourceKey: true },
    });
    if (!job) {
      return { status: "error", message: "That scan could not be found." };
    }
    await db.scanJob.delete({ where: { id: job.id } });
    if (job.sourceKey) {
      await removePrivateUpload(job.sourceKey).catch(() => undefined);
    }
    revalidatePath(`/business/${encode(businessId)}`, "layout");
    return { status: "success", message: "Scan discarded.", redirectTo: `/business/${encode(businessId)}/scan` };
  } catch (error) {
    return actionError(error);
  }
}
