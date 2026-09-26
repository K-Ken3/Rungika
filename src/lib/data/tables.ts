import "server-only";

import { randomUUID } from "node:crypto";
import { FieldType, Prisma, RecordStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getBusinessPermissionKeys, hasBusinessPermission } from "@/lib/auth/authorization";
import {
  normalizeRestrictedPermissionKeys,
  restrictRecordData,
  visibleFieldKeys,
  type BusinessPermissionKey,
} from "@/lib/permissions";
import {
  assertOperationalBusinessAccess,
  BusinessConflictError,
  BusinessValidationError,
  requireOperationalBusinessAccess,
} from "@/lib/data/business";
import {
  fieldOptionsSchema,
  fieldValidationSchema,
  validateCustomFieldValue,
  type CustomFieldRule,
} from "@/components/business/rules";

export interface TableFieldDTO {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  position: number;
  defaultValue: Prisma.JsonValue | null;
  options: Prisma.JsonValue | null;
  validation: Prisma.JsonValue | null;
  restricted: boolean;
  allowedPermissionKeys: BusinessPermissionKey[];
}

export interface TableSummaryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fieldCount: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecordListItemDTO {
  id: string;
  data: Record<string, unknown>;
  status: RecordStatus;
  createdByName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface TableWorkspaceQuery {
  search?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
  page?: number;
}

export interface TableWorkspaceDTO {
  tables: TableSummaryDTO[];
  selectedTable: (TableSummaryDTO & { fields: TableFieldDTO[] }) | null;
  records: RecordListItemDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  query: {
    search: string;
    status: "ACTIVE" | "ARCHIVED" | "ALL";
  };
  canCreateTables: boolean;
  canDeleteTables: boolean;
  canCreateRecords: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
  canExportRecords: boolean;
  canManageFields: boolean;
}

type TableWithFields = Prisma.CustomTableGetPayload<{
  include: {
    fields: {
      orderBy: [{ position: "asc" }, { createdAt: "asc" }];
      include: { permissions: { include: { permission: { select: { key: true } } } } };
    };
    _count: { select: { records: true } };
  };
}>;

const tableFieldInclude = {
  orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  include: {
    permissions: { include: { permission: { select: { key: true } } } },
  },
};

type RecordWithUsers = Prisma.CustomRecordGetPayload<{
  include: {
    createdBy: { select: { name: true } };
    updatedBy: { select: { name: true } };
  };
}>;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function fieldKey(value: string) {
  const base = slugify(value);
  if (!base) {
    return `field_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  }
  return /^[a-z_]/.test(base) ? base : `field_${base}`;
}

function mapTable(
  table: TableWithFields,
  fieldCount: number = table.fields.length,
): TableSummaryDTO {
  return {
    id: table.id,
    name: table.name,
    slug: table.slug,
    description: table.description,
    fieldCount,
    recordCount: table._count.records,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}

function fieldPermissionKeys(field: TableWithFields["fields"][number]): string[] {
  return field.permissions.map((entry) => entry.permission.key);
}

function mapField(field: TableWithFields["fields"][number]): TableFieldDTO {
  const allowedPermissionKeys = normalizeRestrictedPermissionKeys(
    fieldPermissionKeys(field),
  );
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    position: field.position,
    defaultValue: field.defaultValue,
    options: field.options,
    validation: field.validation,
    restricted: allowedPermissionKeys.length > 0,
    allowedPermissionKeys,
  };
}

function safeRecordData(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapRecord(
  record: RecordWithUsers,
  allowedFieldKeys: ReadonlySet<string>,
): RecordListItemDTO {
  return {
    id: record.id,
    data: restrictRecordData(safeRecordData(record.data), allowedFieldKeys),
    status: record.status,
    createdByName: record.createdBy.name,
    updatedByName: record.updatedBy?.name ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    archivedAt: record.archivedAt?.toISOString() ?? null,
  };
}

function parseFieldMetadata(type: FieldType, options: unknown, validation: unknown) {
  if (type === "SELECT" || type === "MULTI_SELECT") {
    const parsed = fieldOptionsSchema.safeParse(options);
    if (!parsed.success) {
      throw new BusinessValidationError(
        parsed.error.issues[0]?.message ?? "Select options are invalid.",
      );
    }
    return {
      options: parsed.data as Prisma.InputJsonValue,
      validation:
        validation === undefined || validation === null || validation === ""
          ? undefined
          : parseValidation(validation),
    };
  }
  if (options !== undefined && options !== null && options !== "") {
    throw new BusinessValidationError("Only select fields can define options.");
  }
  return {
    options: undefined,
    validation:
      validation === undefined || validation === null || validation === ""
        ? undefined
        : parseValidation(validation),
  };
}

function parseValidation(value: unknown) {
  const parsed = fieldValidationSchema.safeParse(value);
  if (!parsed.success) {
    throw new BusinessValidationError(
      parsed.error.issues[0]?.message ?? "Field validation is invalid.",
    );
  }
  return parsed.data as Prisma.InputJsonValue;
}

function parseDefaultValue(field: CustomFieldRule, value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (field.type === "FILE") {
    throw new BusinessValidationError("File fields cannot have a default storage key.");
  }
  const result = validateCustomFieldValue(
    { ...field, required: false },
    value,
  );
  if (!result.valid || result.value === undefined) {
    throw new BusinessValidationError(result.error ?? "The default value is invalid.");
  }
  return result.value;
}

async function loadTable(userId: string, businessId: string, tableId: string) {
  const table = await db.customTable.findFirst({
    where: {
      id: tableId,
      businessId,
      business: { memberships: { some: { userId, status: "ACTIVE" } } },
    },
    include: {
      fields: tableFieldInclude,
      _count: { select: { records: true } },
    },
  });
  if (!table) {
    throw new BusinessValidationError("The table does not exist.");
  }
  return table;
}

async function allowedFieldKeysFor(
  userId: string,
  businessId: string,
  table: TableWithFields,
): Promise<Set<string>> {
  const permissionKeys = await getBusinessPermissionKeys(userId, businessId);
  return visibleFieldKeys(
    table.fields.map((field) => ({
      key: field.key,
      allowedPermissionKeys: fieldPermissionKeys(field),
    })),
    permissionKeys,
  );
}

export async function getTableWorkspace(
  userId: string,
  businessId: string,
  requestedTableId?: string,
  query: TableWorkspaceQuery = {},
): Promise<TableWorkspaceDTO> {
  const access = await requireOperationalBusinessAccess(userId, businessId, "tables.view");
  const search = query.search?.trim().slice(0, 100) ?? "";
  const status = query.status === "ARCHIVED" || query.status === "ALL" ? query.status : "ACTIVE";
  const page = Number.isInteger(query.page) && (query.page ?? 0) > 0 ? (query.page ?? 1) : 1;
  const pageSize = 20;
  const tables = await db.customTable.findMany({
    where: {
      businessId,
      business: { memberships: { some: { userId, status: "ACTIVE" } } },
    },
    include: {
      fields: tableFieldInclude,
      _count: { select: { records: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const selected = tables.find((table) => table.id === requestedTableId) ?? tables[0] ?? null;
  const allowedFieldKeys = selected
    ? await allowedFieldKeysFor(userId, businessId, selected)
    : new Set<string>();
  const recordWhere: Prisma.CustomRecordWhereInput = selected
    ? {
        businessId,
        tableId: selected.id,
        business: { memberships: { some: { userId, status: "ACTIVE" } } },
      }
    : {};
  if (selected && status !== "ALL") {
    recordWhere.status = status;
  }
  if (selected && search) {
    const searchableFields = selected.fields.filter(
      (field) =>
        allowedFieldKeys.has(field.key) &&
        ["SHORT_TEXT", "LONG_TEXT", "EMAIL", "PHONE", "URL", "DATE", "DATETIME", "SELECT"].includes(
          field.type,
        ),
    );
    if (searchableFields.length > 0) {
      recordWhere.AND = [
        {
          OR: searchableFields.map((field) => ({
            data: {
              path: [field.key],
              string_contains: search,
              mode: "insensitive",
            },
          })),
        },
      ];
    }
  }
  const [records, totalRecords, canCreateTables, canDeleteTables, canCreateRecords, canEditRecords, canDeleteRecords, canExportRecords, canManageFields] =
    await Promise.all([
      selected
        ? db.customRecord.findMany({
            where: recordWhere,
            include: {
              createdBy: { select: { name: true } },
              updatedBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          })
        : Promise.resolve([]),
      selected ? db.customRecord.count({ where: recordWhere }) : Promise.resolve(0),
      hasPermissionForUser(userId, businessId, "tables.create"),
      hasPermissionForUser(userId, businessId, "tables.delete"),
      hasPermissionForUser(userId, businessId, "records.create"),
      hasPermissionForUser(userId, businessId, "records.edit"),
      hasPermissionForUser(userId, businessId, "records.delete"),
      hasPermissionForUser(userId, businessId, "records.export"),
      hasPermissionForUser(userId, businessId, "tables.edit"),
    ]);
  const pageCount = Math.max(1, Math.ceil(totalRecords / pageSize));
  return {
    tables: tables.map(mapTable),
    selectedTable: selected
      ? {
          ...mapTable(
            selected,
            selected.fields.filter(
              (field) => canManageFields || allowedFieldKeys.has(field.key),
            ).length,
          ),
          fields: selected.fields
            .filter(
              (field) => canManageFields || allowedFieldKeys.has(field.key),
            )
            .map(mapField),
        }
      : null,
    records: records.map((record) => mapRecord(record, allowedFieldKeys)),
    pagination: { page, pageSize, total: totalRecords, pageCount },
    query: { search, status },
    canCreateTables: !access.business.adminHold && canCreateTables,
    canDeleteTables: !access.business.adminHold && canDeleteTables,
    canCreateRecords: !access.business.adminHold && canCreateRecords,
    canEditRecords: !access.business.adminHold && canEditRecords,
    canDeleteRecords: !access.business.adminHold && canDeleteRecords,
    canExportRecords: !access.business.adminHold && canExportRecords,
    canManageFields: !access.business.adminHold && canManageFields,
  };
}

async function hasPermissionForUser(
  userId: string,
  businessId: string,
  permission:
    | "tables.create"
    | "tables.delete"
    | "tables.edit"
    | "records.create"
    | "records.edit"
    | "records.delete"
    | "records.export",
) {
  return hasBusinessPermission(userId, businessId, permission);
}

export async function createCustomTable(input: {
  userId: string;
  businessId: string;
  name: string;
  description?: string;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.create");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new BusinessValidationError("Table name must contain 2 to 100 characters.");
  }
  const baseSlug = slugify(name);
  if (!baseSlug) {
    throw new BusinessValidationError("Table name must include letters or numbers.");
  }
  return db.$transaction(async (tx) => {
    let slug = baseSlug;
    for (let suffix = 2; await tx.customTable.findFirst({ where: { businessId: input.businessId, slug } }); suffix += 1) {
      slug = `${baseSlug}_${suffix}`;
    }
    const table = await tx.customTable.create({
      data: {
        businessId: input.businessId,
        name,
        slug,
        description: input.description?.trim() || null,
        createdById: input.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "TABLE.CREATED",
        entityType: "CustomTable",
        entityId: table.id,
        metadata: { name, slug },
      },
    });
    return table;
  });
}

export async function deleteCustomTable(input: {
  userId: string;
  businessId: string;
  tableId: string;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.delete");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  if (table._count.records > 0) {
    throw new BusinessConflictError("Delete or archive all records before deleting this table.");
  }
  await db.$transaction(async (tx) => {
    await tx.customTable.delete({ where: { id: table.id } });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "TABLE.DELETED",
        entityType: "CustomTable",
        entityId: table.id,
        metadata: { name: table.name },
      },
    });
  });
}

async function syncFieldPermissions(
  tx: Prisma.TransactionClient,
  fieldId: string,
  allowedPermissionKeys: BusinessPermissionKey[],
) {
  await tx.fieldPermission.deleteMany({ where: { fieldId } });
  if (allowedPermissionKeys.length === 0) {
    return;
  }
  const permissions = await tx.permission.findMany({
    where: { key: { in: [...allowedPermissionKeys] } },
    select: { id: true, key: true },
  });
  if (permissions.length !== allowedPermissionKeys.length) {
    throw new BusinessValidationError(
      "One or more selected field permissions are not configured. Run the database seed and try again.",
    );
  }
  await tx.fieldPermission.createMany({
    data: permissions.map((permission) => ({ fieldId, permissionId: permission.id })),
    skipDuplicates: true,
  });
}

export async function createCustomField(input: {
  userId: string;
  businessId: string;
  tableId: string;
  key?: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  options?: unknown;
  validation?: unknown;
  allowedPermissionKeys?: unknown;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.edit");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const key = fieldKey(input.key?.trim() || input.label);
  if (table.fields.some((field) => field.key === key)) {
    throw new BusinessConflictError("A field with this key already exists on the table.");
  }
  const metadata = parseFieldMetadata(input.type, input.options, input.validation);
  const fieldRule: CustomFieldRule = {
    id: "new",
    key,
    label: input.label.trim(),
    type: input.type,
    required: input.required,
    options: metadata.options as Prisma.JsonValue | undefined,
    validation: metadata.validation as Prisma.JsonValue | undefined,
  };
  const defaultValue = parseDefaultValue(fieldRule, input.defaultValue);
  const allowedPermissionKeys = normalizeRestrictedPermissionKeys(
    input.allowedPermissionKeys,
  );
  const position =
    table.fields.reduce((maximum, field) => Math.max(maximum, field.position), 0) + 1;
  return db.$transaction(async (tx) => {
    const field = await tx.customField.create({
      data: {
        tableId: table.id,
        key,
        label: input.label.trim(),
        type: input.type,
        required: input.required,
        position,
        defaultValue: defaultValue ?? Prisma.JsonNull,
        options: metadata.options ?? Prisma.JsonNull,
        validation: metadata.validation ?? Prisma.JsonNull,
      },
    });
    await syncFieldPermissions(tx, field.id, allowedPermissionKeys);
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "FIELD.CREATED",
        entityType: "CustomField",
        entityId: field.id,
        metadata: {
          tableId: table.id,
          key,
          type: input.type,
          required: input.required,
          allowedPermissionKeys,
        },
      },
    });
    return field;
  });
}

export async function updateCustomField(input: {
  userId: string;
  businessId: string;
  tableId: string;
  fieldId: string;
  label: string;
  required: boolean;
  defaultValue?: unknown;
  options?: unknown;
  validation?: unknown;
  allowedPermissionKeys?: unknown;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.edit");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const field = table.fields.find((candidate) => candidate.id === input.fieldId);
  if (!field) {
    throw new BusinessValidationError("The field does not exist on this table.");
  }
  const metadata = parseFieldMetadata(field.type, input.options, input.validation);
  const fieldRule: CustomFieldRule = {
    id: field.id,
    key: field.key,
    label: input.label.trim(),
    type: field.type,
    required: input.required,
    options: metadata.options as Prisma.JsonValue | undefined,
    validation: metadata.validation as Prisma.JsonValue | undefined,
  };
  const defaultValue = parseDefaultValue(fieldRule, input.defaultValue);
  const allowedPermissionKeys = normalizeRestrictedPermissionKeys(
    input.allowedPermissionKeys,
  );
  return db.$transaction(async (tx) => {
    const updated = await tx.customField.update({
      where: { id: field.id },
      data: {
        label: input.label.trim(),
        required: input.required,
        defaultValue: defaultValue === undefined ? Prisma.DbNull : defaultValue,
        options: metadata.options === undefined ? Prisma.DbNull : metadata.options,
        validation: metadata.validation === undefined ? Prisma.DbNull : metadata.validation,
      },
    });
    await syncFieldPermissions(tx, field.id, allowedPermissionKeys);
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "FIELD.UPDATED",
        entityType: "CustomField",
        entityId: field.id,
        metadata: {
          tableId: table.id,
          key: field.key,
          required: input.required,
          allowedPermissionKeys,
        },
      },
    });
    return updated;
  });
}

export async function deleteCustomField(input: {
  userId: string;
  businessId: string;
  tableId: string;
  fieldId: string;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "tables.edit");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const field = table.fields.find((candidate) => candidate.id === input.fieldId);
  if (!field) {
    throw new BusinessValidationError("The field does not exist on this table.");
  }
  if (table._count.records > 0) {
    throw new BusinessConflictError("Fields cannot be deleted after records have been created.");
  }
  await db.$transaction(async (tx) => {
    await tx.customField.delete({ where: { id: field.id } });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "FIELD.DELETED",
        entityType: "CustomField",
        entityId: field.id,
        metadata: { tableId: table.id, key: field.key },
      },
    });
  });
}

function formValue(formData: FormData, key: string, type: FieldType) {
  if (type === "MULTI_SELECT") {
    return formData.getAll(`field:${key}`).map(String);
  }
  if (type === "CHECKBOX") {
    return formData.get(`field:${key}`) === "on";
  }
  const value = formData.get(`field:${key}`);
  return value === null ? undefined : String(value);
}

function buildRecordData(
  formData: FormData,
  fields: TableWithFields["fields"],
  useDefaults: boolean,
  allowedFieldKeys: ReadonlySet<string>,
  existingData: Record<string, unknown>,
) {
  const data: Record<string, Prisma.InputJsonValue> = {};
  for (const field of fields) {
    if (!allowedFieldKeys.has(field.key)) {
      if (Object.prototype.hasOwnProperty.call(existingData, field.key)) {
        data[field.key] = existingData[field.key] as Prisma.InputJsonValue;
      }
      continue;
    }
    let input: unknown = formValue(formData, field.key, field.type);
    if (
      useDefaults &&
      (input === undefined || (Array.isArray(input) && input.length === 0)) &&
      field.defaultValue !== null
    ) {
      input = field.defaultValue;
    }
    const result = validateCustomFieldValue(
      {
        id: field.id,
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        defaultValue: field.defaultValue,
        options: field.options,
        validation: field.validation,
      },
      input,
    );
    if (!result.valid) {
      throw new BusinessValidationError(result.error ?? `${field.label} is invalid.`);
    }
    if (result.value !== undefined) {
      data[field.key] = result.value;
    }
  }
  return data as Prisma.InputJsonObject;
}

export async function getCustomRecord(input: {
  userId: string;
  businessId: string;
  tableId: string;
  recordId?: string;
}) {
  await requireOperationalBusinessAccess(
    input.userId,
    input.businessId,
    input.recordId ? "records.view" : "records.create",
  );
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const allowedFieldKeys = await allowedFieldKeysFor(
    input.userId,
    input.businessId,
    table,
  );
  const visibleFields = table.fields
    .filter((field) => allowedFieldKeys.has(field.key))
    .map(mapField);
  if (!input.recordId) {
    return {
      table: { name: table.name, fields: visibleFields },
      record: null as RecordListItemDTO | null,
    };
  }
  const record = await db.customRecord.findFirst({
    where: {
      id: input.recordId,
      businessId: input.businessId,
      tableId: input.tableId,
      business: { memberships: { some: { userId: input.userId, status: "ACTIVE" } } },
    },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
  if (!record) {
    throw new BusinessValidationError("The record does not exist.");
  }
  return {
    table: { name: table.name, fields: visibleFields },
    record: mapRecord(record, allowedFieldKeys),
  };
}

export async function createCustomRecord(input: {
  userId: string;
  businessId: string;
  tableId: string;
  formData: FormData;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.create");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const data = buildRecordData(
    input.formData,
    table.fields,
    true,
    await allowedFieldKeysFor(input.userId, input.businessId, table),
    {},
  );
  return db.$transaction(async (tx) => {
    const record = await tx.customRecord.create({
      data: {
        businessId: input.businessId,
        tableId: input.tableId,
        data,
        createdById: input.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "RECORD.CREATED",
        entityType: "CustomRecord",
        entityId: record.id,
        metadata: { tableId: input.tableId },
      },
    });
    return record;
  });
}

export async function updateCustomRecord(input: {
  userId: string;
  businessId: string;
  tableId: string;
  recordId: string;
  formData: FormData;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.edit");
  const table = await loadTable(input.userId, input.businessId, input.tableId);
  const current = await db.customRecord.findFirst({
    where: {
      id: input.recordId,
      businessId: input.businessId,
      tableId: input.tableId,
      business: { memberships: { some: { userId: input.userId, status: "ACTIVE" } } },
    },
    select: { id: true, data: true },
  });
  if (!current) {
    throw new BusinessValidationError("The record does not exist.");
  }
  const data = buildRecordData(
    input.formData,
    table.fields,
    false,
    await allowedFieldKeysFor(input.userId, input.businessId, table),
    safeRecordData(current.data),
  );
  return db.$transaction(async (tx) => {
    const record = await tx.customRecord.update({
      where: { id: current.id },
      data: {
        data,
        updatedById: input.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "RECORD.UPDATED",
        entityType: "CustomRecord",
        entityId: record.id,
        metadata: { tableId: input.tableId },
      },
    });
    return record;
  });
}

export async function archiveCustomRecord(input: {
  userId: string;
  businessId: string;
  tableId: string;
  recordId: string;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "records.delete");
  const record = await db.customRecord.findFirst({
    where: {
      id: input.recordId,
      businessId: input.businessId,
      tableId: input.tableId,
      business: { memberships: { some: { userId: input.userId, status: "ACTIVE" } } },
    },
  });
  if (!record) {
    throw new BusinessValidationError("The record does not exist.");
  }
  if (record.status === "ARCHIVED") {
    return record;
  }
  return db.$transaction(async (tx) => {
    const archived = await tx.customRecord.update({
      where: { id: record.id },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        updatedById: input.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "RECORD.ARCHIVED",
        entityType: "CustomRecord",
        entityId: record.id,
        metadata: { tableId: input.tableId },
      },
    });
    return archived;
  });
}
