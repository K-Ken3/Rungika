import "server-only";

import { FieldType, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertOperationalBusinessAccess, BusinessValidationError } from "@/lib/data/business";
import { validateCustomFieldValue, type CustomFieldRule } from "@/components/business/rules";
import {
  buildImportPlan,
  type ParsedSpreadsheet,
  type SpreadsheetCell,
} from "@/lib/spreadsheet/core";
import { coerceImportValue, importSpreadsheetAsTable } from "@/lib/spreadsheet/server";

const IMPORT_BATCH_SIZE = 200;
const IMPORT_TX_MAX_WAIT_MS = 30_000;
const IMPORT_TX_TIMEOUT_MS = 180_000;
const SUPPORTED_TYPES = new Set<string>(Object.values(FieldType));

function toSpreadsheetCell(value: string | null | undefined): SpreadsheetCell {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface ScanImportResult {
  tableId: string;
  tableName: string;
  createdCount: number;
  skippedCount: number;
}

export async function importScanAsNewTable(input: {
  userId: string;
  businessId: string;
  tableName: string;
  columns: Array<{ label: string }>;
  rows: Array<Array<string | null>>;
}): Promise<ScanImportResult> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");

  if (input.columns.length === 0) {
    throw new BusinessValidationError("The scan has no columns to import.");
  }

  const parsed: ParsedSpreadsheet = {
    sheetName: input.tableName,
    sheetNames: [input.tableName],
    headers: input.columns.map((column, index) => column.label.trim() || `Column ${index + 1}`),
    rows: input.rows.map((row) => input.columns.map((_unused, index) => toSpreadsheetCell(row[index]))),
  };

  const plan = buildImportPlan(parsed, input.tableName);
  const result = await importSpreadsheetAsTable({
    userId: input.userId,
    businessId: input.businessId,
    tableName: plan.tableName,
    columns: plan.columns.map((column) => ({
      label: column.label,
      type: (SUPPORTED_TYPES.has(column.type) ? column.type : FieldType.SHORT_TEXT) as FieldType,
      values: column.values,
    })),
  });

  return {
    tableId: result.table.id,
    tableName: result.table.name,
    createdCount: result.recordCount,
    skippedCount: 0,
  };
}

export async function importScanAsExistingTable(input: {
  userId: string;
  businessId: string;
  tableId: string;
  mapping: Record<string, string>;
  rows: Array<Array<string | null>>;
}): Promise<ScanImportResult> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.create");
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.view");

  const table = await db.customTable.findFirst({
    where: { id: input.tableId, businessId: input.businessId },
    select: {
      id: true,
      name: true,
      fields: { orderBy: { position: "asc" } },
    },
  });
  if (!table) {
    throw new BusinessValidationError("Choose a table to import into.");
  }

  const fieldByKey = new Map(table.fields.map((field) => [field.key, field]));
  const mapped = Object.entries(input.mapping)
    .map(([index, key]) => ({ index: Number(index), key }))
    .filter((entry) => Number.isInteger(entry.index) && fieldByKey.has(entry.key));

  if (mapped.length === 0) {
    throw new BusinessValidationError("Map at least one column to a business field.");
  }

  const requiredKeys = table.fields.filter((field) => field.required).map((field) => field.key);

  return db.$transaction(
    async (tx) => {
      let createdCount = 0;
      let skippedCount = 0;

      const prepared: Array<Record<string, Prisma.InputJsonValue>> = [];
      for (const row of input.rows) {
        const data: Record<string, Prisma.InputJsonValue> = {};
        let ok = true;
        for (const { index, key } of mapped) {
          const field = fieldByKey.get(key)!;
          const result = validateCustomFieldValue(
            field as unknown as CustomFieldRule,
            coerceImportValue(field.type, toSpreadsheetCell(row[index])),
          );
          if (result.valid) {
            if (result.value !== undefined) {
              data[field.key] = result.value as Prisma.InputJsonValue;
            }
          } else if (field.required) {
            ok = false;
            break;
          }
        }
        if (ok) {
          for (const key of requiredKeys) {
            if (!(key in data)) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) {
          skippedCount += 1;
          continue;
        }
        prepared.push(data);
      }

      for (let offset = 0; offset < prepared.length; offset += IMPORT_BATCH_SIZE) {
        const batch = prepared.slice(offset, offset + IMPORT_BATCH_SIZE);
        for (const data of batch) {
          await tx.customRecord.create({
            data: {
              businessId: input.businessId,
              tableId: table.id,
              data: data as Prisma.InputJsonObject,
              createdById: input.userId,
            },
          });
          createdCount += 1;
        }
      }

      await tx.auditLog.create({
        data: {
          businessId: input.businessId,
          actorId: input.userId,
          action: "RECORDS.IMPORTED",
          entityType: "CustomTable",
          entityId: table.id,
          metadata: {
            imported: true,
            source: "scan",
            recordCount: createdCount,
            skippedCount,
          },
        },
      });

      return {
        tableId: table.id,
        tableName: table.name,
        createdCount,
        skippedCount,
      };
    },
    { maxWait: IMPORT_TX_MAX_WAIT_MS, timeout: IMPORT_TX_TIMEOUT_MS },
  );
}
