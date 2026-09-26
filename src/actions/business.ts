"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldType, Prisma, SupportCaseStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import {
  BusinessAccessError,
  BusinessConflictError,
  BusinessRestrictionError,
  BusinessValidationError,
  createBusinessRole,
  createBusinessUnit,
  createBusinessWithDefaults,
  createSupportCase,
  deleteBusinessUnit,
  invitePerson,
  markAllBusinessNotificationsRead,
  markNotificationRead,
  updateBusinessProfile,
  updateBusinessRole,
  updateBusinessUnit,
  updatePersonMembership,
  updateSupportCase,
} from "@/lib/data/business";
import {
  archiveCustomRecord,
  createCustomField,
  createCustomRecord,
  createCustomTable,
  deleteCustomField,
  deleteCustomTable,
  updateCustomField,
  updateCustomRecord,
} from "@/lib/data/tables";
import { submitOwnerPaymentClaim } from "@/lib/data/owner-billing";

export type BusinessActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialBusinessActionState: BusinessActionState = { status: "idle" };

const businessIdSchema = z.string().min(10).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const recordIdSchema = z.string().min(10).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);
const shortOptionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(120).optional(),
);

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  ),
  category: shortOptionalText,
  description: optionalText,
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  location: shortOptionalText,
  phone: shortOptionalText,
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  timezone: z.string().trim().min(1).max(80).default("UTC"),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: shortOptionalText,
  description: optionalText,
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  location: shortOptionalText,
  phone: shortOptionalText,
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  timezone: z.string().trim().min(1).max(80),
});

const unitSchema = z.object({
  unitId: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  type: z.string().trim().min(2).max(50),
  description: optionalText,
  parentId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(10).max(64).optional(),
  ),
});

const inviteSchema = z.object({
  email: z.email(),
  phone: shortOptionalText,
  roleId: z.string().min(10).max(64),
  unitId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(10).max(64).optional(),
  ),
});

const membershipSchema = z.object({
  membershipId: z.string().min(10).max(64),
  roleId: z.string().min(10).max(64),
  unitId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(10).max(64).optional(),
  ),
  jobTitle: shortOptionalText,
  startDate: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/u, "Start date must use the YYYY-MM-DD format.")
        .optional(),
    ),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const roleSchema = z.object({
  roleId: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  description: optionalText,
  permissionKeys: z.array(z.string().min(3).max(100)).min(1),
});

const tableSchema = z.object({
  tableId: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  description: optionalText,
});

const fieldSchema = z.object({
  fieldId: z.string().optional(),
  key: shortOptionalText,
  label: z.string().trim().min(1).max(100),
  type: z.enum(FieldType),
  required: z.boolean(),
  defaultValue: optionalText,
  options: optionalText,
  validation: optionalText,
});

const recordSchema = z.object({
  tableId: z.string().min(10).max(64),
  recordId: z.string().optional(),
});

const notificationSchema = z.object({
  notificationId: z.string().min(10).max(64).optional(),
});

const supportSchema = z.object({
  caseId: z.string().optional(),
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(5000),
  status: z.enum(SupportCaseStatus).optional(),
});

const claimSentAtSchema = z.preprocess(
  (value) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value.trim())
      ? `${value.trim()}Z`
      : value,
  z.iso.datetime({ offset: true }),
);

const claimSchema = z.object({
  invoiceId: z.string().min(10).max(64),
  reference: z.string().trim().min(3).max(120),
  sentAt: claimSentAtSchema,
  note: optionalText,
});

function value(formData: FormData, key: string) {
  return formData.get(key);
}

function text(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function jsonValue(raw: string): unknown {
  if (!raw.trim()) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

function validationState(error: z.ZodError): BusinessActionState {
  const fieldErrors: Record<string, string[] | undefined> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
  }
  return { status: "error", message: "Check the highlighted fields.", fieldErrors };
}

function actionError(error: unknown): BusinessActionState {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
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
    return { status: "error", message: "A record with these details already exists." };
  }
  if (error instanceof SyntaxError) {
    return { status: "error", message: "Enter valid JSON for the field configuration." };
  }
  return { status: "error", message: "We couldn't complete that request. Please try again." };
}

function revalidateBusiness(businessId: string) {
  revalidatePath(`/business/${encodeURIComponent(businessId)}`, "layout");
}

export async function createBusinessAction(
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = createBusinessSchema.safeParse({
    name: value(formData, "name"),
    slug: value(formData, "slug"),
    category: value(formData, "category"),
    description: value(formData, "description"),
    country: value(formData, "country"),
    location: value(formData, "location"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    timezone: value(formData, "timezone") || "UTC",
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser("/onboarding");
  try {
    const created = await createBusinessWithDefaults({ userId: user.id, ...parsed.data });
    revalidatePath("/", "layout");
    redirect(
      `/business/${encodeURIComponent(created.businessId)}?created=1&due=${encodeURIComponent(created.dueDate)}`,
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBusinessProfileAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  if (!businessIdSchema.safeParse(businessId).success) {
    return { status: "error", message: "The business identifier is invalid." };
  }
  const parsed = profileSchema.safeParse({
    name: value(formData, "name"),
    category: value(formData, "category"),
    description: value(formData, "description"),
    country: value(formData, "country"),
    location: value(formData, "location"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    timezone: value(formData, "timezone"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updateBusinessProfile({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/settings?saved=profile`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createUnitAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  if (!businessIdSchema.safeParse(businessId).success) {
    return { status: "error", message: "The business identifier is invalid." };
  }
  const parsed = unitSchema.safeParse({
    unitId: value(formData, "unitId"),
    name: value(formData, "name"),
    type: value(formData, "type"),
    description: value(formData, "description"),
    parentId: value(formData, "parentId"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  if (parsed.data.unitId) {
    return { status: "error", message: "Use the update action for an existing unit." };
  }
  const user = await requireUser();
  try {
    await createBusinessUnit({
      userId: user.id,
      businessId,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description,
      parentId: parsed.data.parentId,
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/units?saved=created`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUnitAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  if (!businessIdSchema.safeParse(businessId).success) {
    return { status: "error", message: "The business identifier is invalid." };
  }
  const parsed = unitSchema.safeParse({
    unitId: value(formData, "unitId"),
    name: value(formData, "name"),
    type: value(formData, "type"),
    description: value(formData, "description"),
    parentId: value(formData, "parentId"),
  });
  if (!parsed.success || !parsed.data.unitId) {
    return parsed.success
      ? { status: "error", message: "Choose a unit to update." }
      : validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updateBusinessUnit({
      userId: user.id,
      businessId,
      unitId: parsed.data.unitId,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description,
      parentId: parsed.data.parentId,
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/units?saved=updated`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteUnitAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = z.object({ unitId: z.string().min(10).max(64) }).safeParse({
    unitId: value(formData, "unitId"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await deleteBusinessUnit({ userId: user.id, businessId, unitId: parsed.data.unitId });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/units?saved=deleted`);
  } catch (error) {
    return actionError(error);
  }
}

export async function invitePersonAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  if (!businessIdSchema.safeParse(businessId).success) {
    return { status: "error", message: "The business identifier is invalid." };
  }
  const parsed = inviteSchema.safeParse({
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    roleId: value(formData, "roleId"),
    unitId: value(formData, "unitId"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    const result = await invitePerson({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(
      `/business/${encodeURIComponent(businessId)}/people?saved=invite-recorded&delivery=${result.deliveryAvailable ? "sent" : "unavailable"}`,
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePersonAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = membershipSchema.safeParse({
    membershipId: value(formData, "membershipId"),
    roleId: value(formData, "roleId"),
    unitId: value(formData, "unitId"),
    jobTitle: value(formData, "jobTitle"),
    startDate: value(formData, "startDate"),
    status: value(formData, "status"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updatePersonMembership({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/people?saved=member`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createRoleAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = roleSchema.safeParse({
    name: value(formData, "name"),
    description: value(formData, "description"),
    permissionKeys: formData.getAll("permissionKeys").map(String),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  if (parsed.data.roleId) {
    return { status: "error", message: "Use the update action for an existing role." };
  }
  const user = await requireUser();
  try {
    await createBusinessRole({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/roles?saved=created`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRoleAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = roleSchema.safeParse({
    roleId: value(formData, "roleId"),
    name: value(formData, "name"),
    description: value(formData, "description"),
    permissionKeys: formData.getAll("permissionKeys").map(String),
  });
  if (!parsed.success || !parsed.data.roleId) {
    return parsed.success
      ? { status: "error", message: "Choose a role to update." }
      : validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updateBusinessRole({
      userId: user.id,
      businessId,
      roleId: parsed.data.roleId,
      name: parsed.data.name,
      description: parsed.data.description,
      permissionKeys: parsed.data.permissionKeys,
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/roles?saved=updated`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createTableAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = tableSchema.safeParse({
    name: value(formData, "name"),
    description: value(formData, "description"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    const table = await createCustomTable({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(table.id)}&saved=created`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTableAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = z.object({ tableId: z.string().min(10).max(64) }).safeParse({
    tableId: value(formData, "tableId"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await deleteCustomTable({ userId: user.id, businessId, tableId: parsed.data.tableId });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables?saved=deleted`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createFieldAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const typeResult = z.enum(FieldType).safeParse(value(formData, "type"));
  const parsed = fieldSchema.safeParse({
    key: value(formData, "key"),
    label: value(formData, "label"),
    type: typeResult.success ? typeResult.data : value(formData, "type"),
    required: value(formData, "required") === "on",
    defaultValue: value(formData, "defaultValue"),
    options: value(formData, "options"),
    validation: value(formData, "validation"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  let options: unknown;
  let validation: unknown;
  try {
    options = jsonValue(text(formData, "options"));
    validation = jsonValue(text(formData, "validation"));
  } catch (error) {
    return actionError(error);
  }
  const user = await requireUser();
  try {
    await createCustomField({
      userId: user.id,
      businessId,
      tableId: text(formData, "tableId"),
      key: parsed.data.key,
      label: parsed.data.label,
      type: parsed.data.type,
      required: parsed.data.required,
      defaultValue: parsed.data.defaultValue,
      options,
      validation,
      allowedPermissionKeys: formData.getAll("allowedPermission").map(String),
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(text(formData, "tableId"))}&saved=field`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateFieldAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const typeResult = z.enum(FieldType).safeParse(value(formData, "currentType"));
  const parsed = fieldSchema.safeParse({
    fieldId: value(formData, "fieldId"),
    label: value(formData, "label"),
    type: typeResult.success ? typeResult.data : value(formData, "currentType"),
    required: value(formData, "required") === "on",
    defaultValue: value(formData, "defaultValue"),
    options: value(formData, "options"),
    validation: value(formData, "validation"),
  });
  if (!parsed.success || !parsed.data.fieldId) {
    return parsed.success
      ? { status: "error", message: "Choose a field to update." }
      : validationState(parsed.error);
  }
  let options: unknown;
  let validation: unknown;
  try {
    options = jsonValue(text(formData, "options"));
    validation = jsonValue(text(formData, "validation"));
  } catch (error) {
    return actionError(error);
  }
  const user = await requireUser();
  try {
    await updateCustomField({
      userId: user.id,
      businessId,
      tableId: text(formData, "tableId"),
      fieldId: parsed.data.fieldId,
      label: parsed.data.label,
      required: parsed.data.required,
      defaultValue: parsed.data.defaultValue,
      options,
      validation,
      allowedPermissionKeys: formData.getAll("allowedPermission").map(String),
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(text(formData, "tableId"))}&saved=field`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteFieldAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = z
    .object({ tableId: z.string().min(10).max(64), fieldId: z.string().min(10).max(64) })
    .safeParse({ tableId: value(formData, "tableId"), fieldId: value(formData, "fieldId") });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await deleteCustomField({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(parsed.data.tableId)}&saved=field-deleted`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createRecordAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = recordSchema.safeParse({ tableId: value(formData, "tableId") });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await createCustomRecord({ userId: user.id, businessId, tableId: parsed.data.tableId, formData });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables/${encodeURIComponent(parsed.data.tableId)}?saved=record`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRecordAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = recordSchema.safeParse({
    tableId: value(formData, "tableId"),
    recordId: value(formData, "recordId"),
  });
  if (!parsed.success || !parsed.data.recordId || !recordIdSchema.safeParse(parsed.data.recordId).success) {
    return parsed.success
      ? { status: "error", message: "Choose a record to update." }
      : validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updateCustomRecord({ userId: user.id, businessId, tableId: parsed.data.tableId, recordId: parsed.data.recordId, formData });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables/${encodeURIComponent(parsed.data.tableId)}?saved=record`);
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveRecordAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = recordSchema.safeParse({
    tableId: value(formData, "tableId"),
    recordId: value(formData, "recordId"),
  });
  if (!parsed.success || !parsed.data.recordId) {
    return parsed.success
      ? { status: "error", message: "Choose a record to archive." }
      : validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await archiveCustomRecord({ userId: user.id, businessId, tableId: parsed.data.tableId, recordId: parsed.data.recordId });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/tables/${encodeURIComponent(parsed.data.tableId)}?saved=archived`);
  } catch (error) {
    return actionError(error);
  }
}

export async function markNotificationAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = notificationSchema.safeParse({ notificationId: value(formData, "notificationId") });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    if (parsed.data.notificationId) {
      await markNotificationRead({ userId: user.id, businessId, notificationId: parsed.data.notificationId });
    } else {
      await markAllBusinessNotificationsRead({ userId: user.id, businessId });
    }
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/notifications?saved=read`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createSupportCaseAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = supportSchema.safeParse({
    subject: value(formData, "subject"),
    message: value(formData, "message"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await createSupportCase({ userId: user.id, businessId, ...parsed.data });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/support?saved=created`);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSupportCaseAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = supportSchema.safeParse({
    caseId: value(formData, "caseId"),
    subject: value(formData, "subject"),
    message: value(formData, "message"),
    status: value(formData, "status"),
  });
  if (!parsed.success || !parsed.data.caseId || !parsed.data.status) {
    return parsed.success
      ? { status: "error", message: "Choose a support case and status." }
      : validationState(parsed.error);
  }
  const user = await requireUser();
  try {
    await updateSupportCase({ userId: user.id, businessId, caseId: parsed.data.caseId, status: parsed.data.status });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/support?saved=updated`);
  } catch (error) {
    return actionError(error);
  }
}

export async function submitPaymentClaimAction(
  businessId: string,
  _previousState: BusinessActionState,
  formData: FormData,
): Promise<BusinessActionState> {
  const parsed = claimSchema.safeParse({
    invoiceId: value(formData, "invoiceId"),
    reference: value(formData, "reference"),
    sentAt: value(formData, "sentAt"),
    note: value(formData, "note"),
  });
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const proof = value(formData, "proof");
  const user = await requireUser();
  try {
    await submitOwnerPaymentClaim({
      userId: user.id,
      businessId,
      invoiceId: parsed.data.invoiceId,
      reference: parsed.data.reference,
      sentAt: new Date(parsed.data.sentAt),
      note: parsed.data.note,
      proof: proof instanceof File && proof.size > 0 ? proof : undefined,
    });
    revalidateBusiness(businessId);
    redirect(`/business/${encodeURIComponent(businessId)}/billing?saved=claim`);
  } catch (error) {
    return actionError(error);
  }
}
