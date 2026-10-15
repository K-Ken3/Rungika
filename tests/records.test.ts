import { FieldType, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCustomField, createCustomRecord, createCustomTable, getTableWorkspace } from "@/lib/data/tables";

const prisma = new PrismaClient();
const HOOK_TIMEOUT_MS = 120_000;
const TABLE_NAME = "Inline Row Fixture";
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
  await withRetry(async () => {
    const business = await prisma.business.findFirst({
      where: { subscription: { status: "PENDING_PAYMENT" } },
      select: { id: true, memberships: { select: { userId: true, status: true } } },
    });
    if (!business) {
      throw new Error("No trial business available for the records test");
    }
    const membership = business.memberships.find((entry) => entry.status === "ACTIVE");
    if (!membership) {
      throw new Error("No active membership available for the records test");
    }
    businessId = business.id;
    userId = membership.userId;
  });
}, HOOK_TIMEOUT_MS);

afterAll(async () => {
  if (tableId) {
    await withRetry(() => prisma.customTable.deleteMany({ where: { id: tableId } })).catch(() => undefined);
  }
  await prisma.$disconnect();
}, HOOK_TIMEOUT_MS);

describe("inline row record creation against the live database", () => {
  it("stores a datetime-local value as an ISO timestamp", { timeout: HOOK_TIMEOUT_MS * 2 }, async () => {
    await withRetry(async () => {
      await prisma.customTable.deleteMany({ where: { businessId, name: TABLE_NAME } });

      const table = await createCustomTable({
        userId,
        businessId,
        name: TABLE_NAME,
      });
      tableId = table.id;

      await createCustomField({
        userId,
        businessId,
        tableId,
        label: "Customer",
        type: FieldType.SHORT_TEXT,
        required: true,
      });
      await createCustomField({
        userId,
        businessId,
        tableId,
        label: "Met at",
        type: FieldType.DATETIME,
        required: false,
      });

      const formData = new FormData();
      formData.set("tableId", tableId);
      formData.set("field:customer", "Jane Doe");
      formData.set("field:met_at", "2026-10-15T14:30");

      const record = await createCustomRecord({
        userId,
        businessId,
        tableId,
        formData,
      });

      const data = record.data as Record<string, unknown>;
      expect(data.customer).toBe("Jane Doe");
      expect(typeof data.met_at).toBe("string");
      const stored = data.met_at as string;
      expect(stored.endsWith("Z")).toBe(true);
      expect(Number.isNaN(new Date(stored).getTime())).toBe(false);

      const workspace = await getTableWorkspace(userId, businessId, tableId, { status: "ALL" });
      expect(workspace.selectedTable?.name).toBe(TABLE_NAME);
      expect(workspace.pagination.total).toBe(1);
      expect(workspace.records).toHaveLength(1);
      expect(workspace.records[0].data.met_at).toBe(stored);
    });
  });

  it("rejects a record missing a required field", { timeout: HOOK_TIMEOUT_MS }, async () => {
    const formData = new FormData();
    formData.set("tableId", tableId);
    formData.set("field:met_at", "2026-10-15T14:30");
    await expect(
      createCustomRecord({ userId, businessId, tableId, formData }),
    ).rejects.toThrow(/Customer is required/);
  });
});
