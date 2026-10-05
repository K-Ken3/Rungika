import "server-only";

import { FieldType, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertOperationalBusinessAccess, BusinessValidationError } from "@/lib/data/business";
import { validateCustomFieldValue } from "@/components/business/rules";
import type { SpreadsheetCell } from "@/lib/spreadsheet/core";

const IMPORT_BATCH_SIZE = 200;
const IMPORT_TX_MAX_WAIT_MS = 30_000;
const IMPORT_TX_TIMEOUT_MS = 180_000;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function uniqueFieldKey(label: string, taken: Set<string>): string {
  const base = slugify(label);
  const prefix = /^[a-z_]/.test(base) ? base : `field_${base || "column"}`;
  let candidate = prefix || `field_${taken.size + 1}`;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${prefix}_${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

function inferOptions(values: SpreadsheetCell[]): string[] | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === null || value === "") {
      continue;
    }
    const text = String(value).trim();
    if (text.length > 0 && text.length <= 100 && seen.size < 100) {
      seen.add(text);
    }
  }
  if (seen.size < 2) {
    return undefined;
  }
  return [...seen];
}

function coerceImportValue(fieldType: FieldType, value: SpreadsheetCell): unknown {
  if (fieldType === FieldType.MULTI_SELECT) {
    if (value === null || value === "") {
      return [];
    }
    return String(value)
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  if (fieldType === FieldType.CHECKBOX) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === null || value === "") {
      return false;
    }
    return /^(true|yes|y|1)$/i.test(String(value).trim());
  }
  if (fieldType === FieldType.NUMBER || fieldType === FieldType.CURRENCY) {
    if (value === null || value === "") {
      return null;
    }
    if (typeof value === "number") {
      return value;
    }
    const cleaned = String(value).replace(/[$€£₦₭₹RWF,\s]/gi, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value === null ? "" : value;
}

export interface ImportTableInput {
  userId: string;
  businessId: string;
  tableName: string;
  columns: Array<{ label: string; type: FieldType; values: SpreadsheetCell[] }>;
}

export async function importSpreadsheetAsTable(input: ImportTableInput) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.create");

  const tableName = input.tableName.trim();
  if (tableName.length < 2 || tableName.length > 100) {
    throw new BusinessValidationError("Table name must contain 2 to 100 characters.");
  }
  if (input.columns.length === 0) {
    throw new BusinessValidationError("The spreadsheet has no columns to import.");
  }

  const baseSlug = slugify(tableName);
  if (!baseSlug) {
    throw new BusinessValidationError("Table name must include letters or numbers.");
  }

  const taken = new Set<string>();
  const fields = input.columns.map((column, index) => {
    const key = uniqueFieldKey(column.label, taken);
    const options =
      column.type === FieldType.SELECT || column.type === FieldType.MULTI_SELECT
        ? inferOptions(column.values)
        : undefined;
    return {
      key,
      label: column.label.slice(0, 100),
      type: column.type,
      required: false,
      position: index,
      options: options && options.length > 1 ? options : null,
    };
  });

  const rowValues = new Map<string, SpreadsheetCell[]>();
  const rowCount = input.columns.reduce(
    (max, column) => Math.max(max, column.values.length),
    0,
  );
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const isEmpty = input.columns.every((column) => {
      const value = column.values[rowIndex];
      return value === null || value === "" || value === undefined;
    });
    if (isEmpty) {
      continue;
    }
    rowValues.set(String(rowIndex), input.columns.map((column) => column.values[rowIndex] ?? null));
  }

  return db.$transaction(async (tx) => {
    let slug = baseSlug;
    for (let suffix = 2; await tx.customTable.findFirst({ where: { businessId: input.businessId, slug } }); suffix += 1) {
      slug = `${baseSlug}_${suffix}`;
    }

    const table = await tx.customTable.create({
      data: {
        businessId: input.businessId,
        name: tableName,
        slug,
        description: `Imported from a spreadsheet on ${new Date().toISOString().slice(0, 10)}`,
        createdById: input.userId,
      },
    });

    await Promise.all(
      fields.map((field) =>
        tx.customField.create({
          data: {
            tableId: table.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            position: field.position,
            options: field.options ?? undefined,
          },
        }),
      ),
    );

    const entries = [...rowValues.entries()];
    for (let offset = 0; offset < entries.length; offset += IMPORT_BATCH_SIZE) {
      const batch = entries.slice(offset, offset + IMPORT_BATCH_SIZE);
      await Promise.all(
        batch.map(([, values]) => {
          const data: Record<string, Prisma.InputJsonValue> = {};
          for (let columnIndex = 0; columnIndex < fields.length; columnIndex += 1) {
            const field = fields[columnIndex];
            const result = validateCustomFieldValue(
              {
                id: field.key,
                key: field.key,
                label: field.label,
                type: field.type,
                required: false,
                defaultValue: null,
                options: field.options,
                validation: null,
              },
              coerceImportValue(field.type, values[columnIndex] ?? null),
            );
            if (result.valid && result.value !== undefined) {
              data[field.key] = result.value;
            }
          }
          return tx.customRecord.create({
            data: {
              businessId: input.businessId,
              tableId: table.id,
              data: data as Prisma.InputJsonObject,
              createdById: input.userId,
            },
          });
        }),
      );
    }

    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "TABLE.CREATED",
        entityType: "CustomTable",
        entityId: table.id,
        metadata: {
          name: tableName,
          slug,
          imported: true,
          recordCount: entries.length,
          fieldCount: fields.length,
        },
      },
    });

    return { table, fieldCount: fields.length, recordCount: entries.length };
  }, { maxWait: IMPORT_TX_MAX_WAIT_MS, timeout: IMPORT_TX_TIMEOUT_MS });
}