"use server";

import { revalidatePath } from "next/cache";
import { FieldType, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import {
  BusinessAccessError,
  BusinessConflictError,
  BusinessRestrictionError,
  BusinessValidationError,
  requireOperationalBusinessAccess,
} from "@/lib/data/business";
import {
  assertSpreadsheetSize,
  buildImportPlan,
  coerceParsedWorkbook,
  parseCsv,
  SpreadsheetImportError,
  type ParsedSpreadsheet,
} from "@/lib/spreadsheet/core";
import { importSpreadsheetAsTable } from "@/lib/spreadsheet/server";

export type SpreadsheetActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  redirectTo?: string;
};

const SUPPORTED_TYPES = new Set<string>(Object.values(FieldType));

function formText(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function actionError(error: unknown): SpreadsheetActionState {
  if (error instanceof SpreadsheetImportError) {
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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { status: "error", message: "A table with these details already exists." };
  }
  return { status: "error", message: "We couldn't complete that request. Please try again." };
}

async function readWorkbook(file: File): Promise<ParsedSpreadsheet> {
  assertSpreadsheetSize(file);
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsv(await file.text());
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheets = workbook.worksheets.filter((sheet) => sheet && sheet.rowCount > 0);
    const first = worksheets[0];
    if (!first) {
      throw new SpreadsheetImportError("The workbook has no sheets with data.");
    }
    return coerceParsedWorkbook({
      sheetNames: worksheets.map((sheet) => sheet.name),
      sheetName: first.name,
      matrix: first.getSheetValues() as unknown[][],
    });
  }

  throw new SpreadsheetImportError(
    "Upload an .xlsx, .xlsm or .csv file. Legacy .xls files are not supported, so save it as .xlsx first.",
  );
}

export async function importTableAction(
  businessId: string,
  _previousState: SpreadsheetActionState,
  formData: FormData,
): Promise<SpreadsheetActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a spreadsheet to import." };
  }

  const parsedName = z
    .string()
    .trim()
    .min(2, "Table name must contain 2 to 100 characters.")
    .max(100, "Table name must contain 2 to 100 characters.")
    .optional()
    .safeParse(formText(formData, "tableName").trim() || undefined);

  const user = await requireUser();

  try {
    await requireOperationalBusinessAccess(user.id, businessId, "tables.create");

    if (!parsedName.success) {
      return {
        status: "error",
        message: parsedName.error.issues[0]?.message ?? "Enter a valid table name.",
      };
    }

    const parsed = await readWorkbook(file);
    const plan = buildImportPlan(parsed, parsedName.data ?? "Imported table");

    const result = await importSpreadsheetAsTable({
      userId: user.id,
      businessId,
      tableName: parsedName.data ?? plan.tableName,
      columns: plan.columns.map((column) => ({
        label: column.label,
        type: (SUPPORTED_TYPES.has(column.type)
          ? column.type
          : FieldType.SHORT_TEXT) as FieldType,
        values: column.values,
      })),
    });

    revalidatePath(`/business/${encodeURIComponent(businessId)}`, "layout");

    return {
      status: "success",
      message: `Imported ${result.recordCount} row${result.recordCount === 1 ? "" : "s"} into "${result.table.name}".`,
      redirectTo: `/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(result.table.id)}&saved=imported`,
    };
  } catch (error) {
    return actionError(error);
  }
}