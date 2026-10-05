import { FieldType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildImportPlan, coerceParsedWorkbook } from "@/lib/spreadsheet/core";
import { importSpreadsheetAsTable } from "@/lib/spreadsheet/server";
import { getTableWorkspace } from "@/lib/data/tables";

const SHEET_NAME = "Client Ledger";
const HEADER = ["Client", "Amount", "Paid", "Due", "Email", "Phone", "Notes"];
const DATA = [
  [
    "Doe, Jane",
    1250.5,
    "yes",
    "2026-03-01",
    "jane@rungika.site",
    "+250 788 111 222",
    "Priority client",
  ],
  ["Acme Ltd", 4300, "no", "2026-04-15", "ap@acme.test", "+250 788 333 444", "Net 30 terms"],
  ['Quote "X" Ltd', 99.99, "yes", "2026-05-20", "x@quote.test", "+250 788 555 666", "Comma, inside notes"],
];

async function readWorkbookFixture() {
  const ExcelJS = (await import("exceljs")).default;
  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet(SHEET_NAME);
  sheet.addRow(HEADER);
  for (const row of DATA) {
    sheet.addRow(row);
  }
  const written = (await source.xlsx.writeBuffer()) as ArrayBuffer;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(written);
  return workbook;
}

const prisma = new PrismaClient();
const HOOK_TIMEOUT_MS = 120_000;
let businessId = "";
let userId = "";
let tableId = "";

async function withRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
  throw lastError;
}

beforeAll(async () => {
  const business = await withRetry(() =>
    prisma.business.findFirst({
      where: { subscription: { status: "PENDING_PAYMENT" } },
      select: { id: true, memberships: { select: { userId: true, status: true } } },
    }),
  );
  if (!business) {
    throw new Error("No trial business available for the import test");
  }
  const membership = business.memberships.find((entry) => entry.status === "ACTIVE");
  if (!membership) {
    throw new Error("No active membership available for the import test");
  }
  businessId = business.id;
  userId = membership.userId;
}, HOOK_TIMEOUT_MS);

afterAll(async () => {
  if (tableId) {
    await withRetry(() =>
      prisma.customTable.deleteMany({ where: { id: tableId } }),
    ).catch(() => undefined);
  }
  await prisma.$disconnect();
}, HOOK_TIMEOUT_MS);

describe("spreadsheet import against the live database", () => {
  it("creates a table with inferred field types and rows", { timeout: HOOK_TIMEOUT_MS * 3 }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({
        where: { businessId, name: "Imported Clients" },
      });

      const workbook = await readWorkbookFixture();
      const sheet = workbook.worksheets[0];
      const parsed = coerceParsedWorkbook({
        sheetNames: workbook.worksheets.map((entry) => entry.name),
        sheetName: sheet.name,
        matrix: sheet.getSheetValues() as unknown[][],
      });
      const plan = buildImportPlan(parsed, "Imported Clients");

      expect(plan.tableName).toBe("Imported Clients");
      expect(plan.rowCount).toBe(3);

      const result = await importSpreadsheetAsTable({
        userId,
        businessId,
        tableName: plan.tableName,
        columns: plan.columns.map((column) => ({
          label: column.label,
          type: column.type as FieldType,
          values: column.values,
        })),
      });
      tableId = result.table.id;

      expect(result.fieldCount).toBe(7);
      expect(result.recordCount).toBe(3);

      const fields = await prisma.customField.findMany({
        where: { tableId },
        orderBy: { position: "asc" },
        select: { key: true, type: true },
      });
      const byKey = new Map(fields.map((field) => [field.key, field.type]));
      expect(byKey.get("client")).toBe(FieldType.SHORT_TEXT);
      expect(byKey.get("amount")).toBe(FieldType.NUMBER);
      expect(byKey.get("paid")).toBe(FieldType.CHECKBOX);
      expect(byKey.get("due")).toBe(FieldType.DATE);
      expect(byKey.get("email")).toBe(FieldType.EMAIL);
      expect(byKey.get("phone")).toBe(FieldType.PHONE);
      expect(byKey.get("notes")).toBe(FieldType.SHORT_TEXT);

      const rows = await prisma.customRecord.findMany({
        where: { tableId },
        orderBy: { createdAt: "asc" },
        select: { data: true },
      });
      expect(rows).toHaveLength(3);

      const first = rows[0].data as Record<string, unknown>;
      expect(first.client).toBe("Doe, Jane");
      expect(first.amount).toBe(1250.5);
      expect(first.paid).toBe(true);
      expect(first.email).toBe("jane@rungika.site");

      const third = rows[2].data as Record<string, unknown>;
      expect(third.client).toBe('Quote "X" Ltd');
      expect(third.notes).toBe("Comma, inside notes");

      const workspace = await getTableWorkspace(userId, businessId, tableId);
      expect(workspace.selectedTable?.name).toBe("Imported Clients");
      expect(workspace.selectedTable?.fields).toHaveLength(7);
      expect(workspace.pagination.total).toBe(3);
      expect(workspace.records).toHaveLength(3);
    });
  });

  it("refuses tables with no usable name", { timeout: HOOK_TIMEOUT_MS }, async () => {
    await expect(
      importSpreadsheetAsTable({
        userId,
        businessId,
        tableName: "x",
        columns: [{ label: "A", type: FieldType.SHORT_TEXT, values: ["1"] }],
      }),
    ).rejects.toThrow(/2 to 100 characters/);
  });
});