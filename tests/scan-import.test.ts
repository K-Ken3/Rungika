import { FieldType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importScanAsExistingTable, importScanAsNewTable } from "@/lib/scan/import";
import { createCustomField, createCustomTable, getTableWorkspace } from "@/lib/data/tables";

const prisma = new PrismaClient();
const HOOK_TIMEOUT_MS = 120_000;
const NEW_TABLE_NAME = "Scanned Harvest Log";
const EXISTING_TABLE_NAME = "Scan Target Ledger";
let businessId = "";
let userId = "";
const createdTableIds: string[] = [];

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
  await withRetry(async () => {
    const business = await prisma.business.findFirst({
      where: { subscription: { status: "PENDING_PAYMENT" } },
      select: { id: true, memberships: { select: { userId: true, status: true } } },
    });
    if (!business) {
      throw new Error("No trial business available for the scan import test");
    }
    const membership = business.memberships.find((entry) => entry.status === "ACTIVE");
    if (!membership) {
      throw new Error("No active membership available for the scan import test");
    }
    businessId = business.id;
    userId = membership.userId;
  });
}, HOOK_TIMEOUT_MS);

afterAll(async () => {
  if (createdTableIds.length > 0) {
    await withRetry(() =>
      prisma.customTable.deleteMany({ where: { id: { in: createdTableIds } } }),
    ).catch(() => undefined);
  }
  await prisma.$disconnect();
}, HOOK_TIMEOUT_MS);

describe("scan import against the live database", () => {
  it("creates a new table from scanned columns and rows", { timeout: HOOK_TIMEOUT_MS * 3 }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({ where: { businessId, name: NEW_TABLE_NAME } });

      const result = await importScanAsNewTable({
        userId,
        businessId,
        tableName: NEW_TABLE_NAME,
        columns: [{ label: "Plot" }, { label: "Kilograms" }, { label: "Harvested" }],
        rows: [
          ["A1", "120", "yes"],
          ["B2", "85.5", "no"],
          ["C3", "40", "yes"],
        ],
      });
      createdTableIds.push(result.tableId);

      expect(result.tableName).toBe(NEW_TABLE_NAME);
      expect(result.createdCount).toBe(3);
      expect(result.skippedCount).toBe(0);

      const fields = await prisma.customField.findMany({
        where: { tableId: result.tableId },
        orderBy: { position: "asc" },
        select: { key: true, type: true },
      });
      const byKey = new Map(fields.map((field) => [field.key, field.type]));
      expect(byKey.get("plot")).toBe(FieldType.SHORT_TEXT);
      expect(byKey.get("kilograms")).toBe(FieldType.NUMBER);
      expect(byKey.get("harvested")).toBe(FieldType.CHECKBOX);

      const rows = await prisma.customRecord.findMany({
        where: { tableId: result.tableId },
        select: { data: true },
      });
      expect(rows).toHaveLength(3);
      const byPlot = new Map(
        rows.map((row) => {
          const data = row.data as Record<string, unknown>;
          return [String(data.plot), data];
        }),
      );
      const first = byPlot.get("A1");
      expect(first?.kilograms).toBe(120);
      expect(first?.harvested).toBe(true);
      const second = byPlot.get("B2");
      expect(second?.kilograms).toBe(85.5);
      expect(second?.harvested).toBe(false);

      const workspace = await getTableWorkspace(userId, businessId, result.tableId, {
        status: "ALL",
      });
      expect(workspace.selectedTable?.name).toBe(NEW_TABLE_NAME);
      expect(workspace.selectedTable?.fields).toHaveLength(3);
      expect(workspace.pagination.total).toBe(3);
    });
  });

  it("appends mapped rows to an existing table and skips unusable rows", {
    timeout: HOOK_TIMEOUT_MS * 3,
  }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({ where: { businessId, name: EXISTING_TABLE_NAME } });

      const table = await createCustomTable({
        userId,
        businessId,
        name: EXISTING_TABLE_NAME,
      });
      createdTableIds.push(table.id);
      await createCustomField({
        userId,
        businessId,
        tableId: table.id,
        label: "Client",
        type: FieldType.SHORT_TEXT,
        required: true,
      });
      await createCustomField({
        userId,
        businessId,
        tableId: table.id,
        label: "Amount",
        type: FieldType.NUMBER,
        required: false,
      });

      const result = await importScanAsExistingTable({
        userId,
        businessId,
        tableId: table.id,
        mapping: { "0": "client", "1": "amount" },
        rows: [
          ["Acme Ltd", "1200"],
          ["   ", "500"],
          ["Borealis", "not a number"],
        ],
      });

      expect(result.tableId).toBe(table.id);
      expect(result.tableName).toBe(EXISTING_TABLE_NAME);
      expect(result.createdCount).toBe(2);
      expect(result.skippedCount).toBe(1);

      const rows = await prisma.customRecord.findMany({
        where: { tableId: table.id },
        select: { data: true },
      });
      expect(rows).toHaveLength(2);
      const byClient = new Map(
        rows.map((row) => {
          const data = row.data as Record<string, unknown>;
          return [String(data.client), data];
        }),
      );
      expect(byClient.get("Acme Ltd")?.amount).toBe(1200);
      const partial = byClient.get("Borealis");
      expect(partial).toBeDefined();
      expect(partial).not.toHaveProperty("amount");
      expect(byClient.has("   ")).toBe(false);

      const workspace = await getTableWorkspace(userId, businessId, table.id, { status: "ALL" });
      expect(workspace.pagination.total).toBe(2);
    });
  });

  it("rejects imports with no mapped or usable columns", { timeout: HOOK_TIMEOUT_MS }, async () => {
    await withRetry(async () => {
      await expect(
        importScanAsNewTable({
          userId,
          businessId,
          tableName: "Empty Scan",
          columns: [],
          rows: [],
        }),
      ).rejects.toThrow(/no columns to import/);

      const table = await prisma.customTable.findFirst({
        where: { businessId, name: EXISTING_TABLE_NAME },
        select: { id: true },
      });
      expect(table).not.toBeNull();

      await expect(
        importScanAsExistingTable({
          userId,
          businessId,
          tableId: table!.id,
          mapping: { "0": "missing_column" },
          rows: [["value"]],
        }),
      ).rejects.toThrow(/Map at least one column/);
    });
  });
});
