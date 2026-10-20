import { FieldType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCustomField,
  createCustomRecord,
  createCustomTable,
  duplicateCustomTable,
  getTableWorkspace,
  updateCustomRecordCell,
  updateCustomTable,
} from "@/lib/data/tables";

const prisma = new PrismaClient();
const HOOK_TIMEOUT_MS = 120_000;
const SOURCE_TABLE_NAME = "Grid Rename Source";
const TARGET_TABLE_NAME = "Grid Rename Target";
const CELL_TABLE_NAME = "Grid Cell Fixture";
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
      throw new Error("No trial business available for the grid table test");
    }
    const membership = business.memberships.find((entry) => entry.status === "ACTIVE");
    if (!membership) {
      throw new Error("No active membership available for the grid table test");
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

describe("table rename, duplicate and cell edits against the live database", () => {
  it("renames a table with a unique slug and an updated description", {
    timeout: HOOK_TIMEOUT_MS * 3,
  }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({
        where: { businessId, name: { in: [SOURCE_TABLE_NAME, TARGET_TABLE_NAME, "Grid Rename Target 2"] } },
      });

      const source = await createCustomTable({
        userId,
        businessId,
        name: SOURCE_TABLE_NAME,
        description: "Original description",
      });
      createdTableIds.push(source.id);
      const target = await createCustomTable({
        userId,
        businessId,
        name: TARGET_TABLE_NAME,
      });
      createdTableIds.push(target.id);

      const renamed = await updateCustomTable({
        userId,
        businessId,
        tableId: source.id,
        name: TARGET_TABLE_NAME,
        description: "Renamed description",
      });

      expect(renamed.name).toBe(TARGET_TABLE_NAME);
      expect(renamed.slug).toBe("grid_rename_target_2");
      expect(renamed.description).toBe("Renamed description");

      const stored = await prisma.customTable.findUnique({
        where: { id: source.id },
        select: { name: true, slug: true, description: true },
      });
      expect(stored?.name).toBe(TARGET_TABLE_NAME);
      expect(stored?.slug).toBe("grid_rename_target_2");
      expect(stored?.description).toBe("Renamed description");
      expect(stored?.slug).not.toBe(target.slug);

      const audit = await prisma.auditLog.findFirst({
        where: { businessId, entityId: source.id, action: "TABLE.UPDATED" },
        select: { metadata: true },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();

      await expect(
        updateCustomTable({
          userId,
          businessId,
          tableId: source.id,
          name: "x",
        }),
      ).rejects.toThrow(/2 to 100 characters/);
    });
  });

  it("duplicates a table with its fields and records", { timeout: HOOK_TIMEOUT_MS * 3 }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({
        where: { businessId, name: { startsWith: `${SOURCE_TABLE_NAME} copy` } },
      });

      const source = await createCustomTable({
        userId,
        businessId,
        name: SOURCE_TABLE_NAME,
        description: "Copied description",
      });
      createdTableIds.push(source.id);
      await createCustomField({
        userId,
        businessId,
        tableId: source.id,
        label: "Customer",
        type: FieldType.SHORT_TEXT,
        required: true,
      });
      await createCustomField({
        userId,
        businessId,
        tableId: source.id,
        label: "Paid",
        type: FieldType.CHECKBOX,
        required: false,
      });
      const formData = new FormData();
      formData.set("tableId", source.id);
      formData.set("field:customer", "Acme Ltd");
      formData.set("field:paid", "on");
      await createCustomRecord({ userId, businessId, tableId: source.id, formData });

      const withRows = await duplicateCustomTable({
        userId,
        businessId,
        tableId: source.id,
        includeRecords: true,
      });
      createdTableIds.push(withRows.id);

      expect(withRows.name).toBe(`${SOURCE_TABLE_NAME} copy`);
      expect(withRows.slug).not.toBe(source.slug);
      expect(withRows.description).toBe("Copied description");

      const copiedFields = await prisma.customField.findMany({
        where: { tableId: withRows.id },
        orderBy: { position: "asc" },
        select: { key: true, type: true, required: true },
      });
      expect(copiedFields.map((field) => field.key)).toEqual(["customer", "paid"]);
      expect(copiedFields[1].type).toBe(FieldType.CHECKBOX);

      const copiedRecords = await prisma.customRecord.findMany({
        where: { tableId: withRows.id },
        select: { data: true },
      });
      expect(copiedRecords).toHaveLength(1);
      const copiedData = copiedRecords[0].data as Record<string, unknown>;
      expect(copiedData.customer).toBe("Acme Ltd");
      expect(copiedData.paid).toBe(true);

      const withoutRows = await duplicateCustomTable({
        userId,
        businessId,
        tableId: source.id,
        includeRecords: false,
      });
      createdTableIds.push(withoutRows.id);
      expect(withoutRows.slug).not.toBe(withRows.slug);
      const emptyRecords = await prisma.customRecord.count({
        where: { tableId: withoutRows.id },
      });
      expect(emptyRecords).toBe(0);

      const workspace = await getTableWorkspace(userId, businessId, withRows.id, {
        status: "ALL",
      });
      expect(workspace.selectedTable?.fields).toHaveLength(2);
      expect(workspace.pagination.total).toBe(1);
    });
  });

  it("updates one cell without clearing the other columns", { timeout: HOOK_TIMEOUT_MS * 3 }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({ where: { businessId, name: CELL_TABLE_NAME } });

      const table = await createCustomTable({ userId, businessId, name: CELL_TABLE_NAME });
      createdTableIds.push(table.id);
      await createCustomField({
        userId,
        businessId,
        tableId: table.id,
        label: "Customer",
        type: FieldType.SHORT_TEXT,
        required: true,
      });
      await createCustomField({
        userId,
        businessId,
        tableId: table.id,
        label: "Notes",
        type: FieldType.SHORT_TEXT,
        required: false,
      });
      const formData = new FormData();
      formData.set("tableId", table.id);
      formData.set("field:customer", "Acme Ltd");
      formData.set("field:notes", "Priority client");
      const record = await createCustomRecord({ userId, businessId, tableId: table.id, formData });

      const cellForm = new FormData();
      cellForm.set("field:customer", "Acme Renewed");
      await updateCustomRecordCell({
        userId,
        businessId,
        tableId: table.id,
        recordId: record.id,
        key: "customer",
        formData: cellForm,
      });

      const updated = await prisma.customRecord.findUnique({
        where: { id: record.id },
        select: { data: true },
      });
      const data = updated?.data as Record<string, unknown>;
      expect(data.customer).toBe("Acme Renewed");
      expect(data.notes).toBe("Priority client");

      const invalidForm = new FormData();
      invalidForm.set("field:customer", "   ");
      await expect(
        updateCustomRecordCell({
          userId,
          businessId,
          tableId: table.id,
          recordId: record.id,
          key: "customer",
          formData: invalidForm,
        }),
      ).rejects.toThrow(/required/);

      const afterFailure = await prisma.customRecord.findUnique({
        where: { id: record.id },
        select: { data: true },
      });
      const keptData = afterFailure?.data as Record<string, unknown>;
      expect(keptData.customer).toBe("Acme Renewed");
      expect(keptData.notes).toBe("Priority client");

      await expect(
        updateCustomRecordCell({
          userId,
          businessId,
          tableId: table.id,
          recordId: record.id,
          key: "missing_column",
          formData: cellForm,
        }),
      ).rejects.toThrow(/does not exist/);
    });
  });
});
