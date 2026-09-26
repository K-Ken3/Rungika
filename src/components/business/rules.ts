import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const CUSTOM_FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "DATETIME",
  "CHECKBOX",
  "SELECT",
  "MULTI_SELECT",
  "EMAIL",
  "PHONE",
  "URL",
  "FILE",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  CURRENCY: "Currency",
  DATE: "Date",
  DATETIME: "Date and time",
  CHECKBOX: "Checkbox",
  SELECT: "Single select",
  MULTI_SELECT: "Multiple select",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  FILE: "File reference",
};

export const fieldOptionsSchema = z
  .array(z.string().trim().min(1).max(100))
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length, {
    error: "Options must be unique.",
  });

export const fieldValidationSchema = z
  .object({
    minLength: z.number().int().nonnegative().max(100_000).optional(),
    maxLength: z.number().int().nonnegative().max(100_000).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().finite().positive().optional(),
    pattern: z.string().max(500).optional(),
    acceptedMimeTypes: z
      .array(z.string().trim().min(1).max(100))
      .max(30)
      .optional(),
    maxFileSize: z.number().int().positive().max(100_000_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minLength !== undefined &&
      value.maxLength !== undefined &&
      value.minLength > value.maxLength
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum length cannot exceed maximum length.",
      });
    }
    if (
      value.min !== undefined &&
      value.max !== undefined &&
      value.min > value.max
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum cannot exceed maximum.",
      });
    }
  });

export type FieldOptions = z.infer<typeof fieldOptionsSchema>;
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

export type CustomFieldRule = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: Prisma.JsonValue | null;
  options?: Prisma.JsonValue | null;
  validation?: Prisma.JsonValue | null;
};

export type FieldValidationResult = {
  valid: boolean;
  value?: Prisma.InputJsonValue;
  error?: string;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmpty(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function errorResult(error: string): FieldValidationResult {
  return { valid: false, error };
}

function readOptions(field: CustomFieldRule): FieldOptions | null | string {
  if (field.options === null || field.options === undefined) {
    return null;
  }
  const parsed = fieldOptionsSchema.safeParse(field.options);
  return parsed.success ? parsed.data : "Stored select options are invalid.";
}

function readValidation(field: CustomFieldRule): FieldValidation | null | string {
  if (field.validation === null || field.validation === undefined) {
    return null;
  }
  const parsed = fieldValidationSchema.safeParse(field.validation);
  return parsed.success ? parsed.data : "Stored field validation is invalid.";
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validatePattern(value: string, pattern: string | undefined) {
  if (!pattern) {
    return null;
  }
  try {
    return new RegExp(pattern).test(value) ? null : "The value does not match the required format.";
  } catch {
    return "The stored validation pattern is invalid.";
  }
}

export function validateCustomFieldValue(
  field: CustomFieldRule,
  input: unknown,
): FieldValidationResult {
  const label = field.label || "This field";

  if (isEmpty(input) && field.required && field.type !== "CHECKBOX") {
    return errorResult(`${label} is required.`);
  }
  if (isEmpty(input) && field.type !== "CHECKBOX") {
    return { valid: true };
  }

  const validation = readValidation(field);
  if (typeof validation === "string") {
    return errorResult(validation);
  }

  if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT" || field.type === "EMAIL" || field.type === "PHONE" || field.type === "URL" || field.type === "FILE") {
    if (typeof input !== "string") {
      return errorResult(`${label} must be text.`);
    }
    const value = input.trim();
    if (field.type === "EMAIL") {
      const parsed = z.email().safeParse(value);
      if (!parsed.success) {
        return errorResult(`${label} must be a valid email address.`);
      }
    }
    if (field.type === "PHONE" && !/^\+?[0-9()\s.-]{7,24}$/.test(value)) {
      return errorResult(`${label} must be a valid phone number.`);
    }
    if (field.type === "URL") {
      const parsed = z.url().safeParse(value);
      if (!parsed.success || !/^https?:\/\//i.test(value)) {
        return errorResult(`${label} must be an HTTP or HTTPS URL.`);
      }
    }
    if (field.type === "FILE") {
      if (
        value.length > 500 ||
        !/^[A-Za-z0-9][A-Za-z0-9/_:.-]*$/.test(value) ||
        value.includes("..")
      ) {
        return errorResult(`${label} must be a safe storage object key.`);
      }
    }
    if (
      validation?.minLength !== undefined &&
      value.length < validation.minLength
    ) {
      return errorResult(`${label} must be at least ${validation.minLength} characters.`);
    }
    if (
      validation?.maxLength !== undefined &&
      value.length > validation.maxLength
    ) {
      return errorResult(`${label} must use no more than ${validation.maxLength} characters.`);
    }
    const patternError = validatePattern(value, validation?.pattern);
    return patternError ? errorResult(patternError) : { valid: true, value };
  }

  if (field.type === "NUMBER" || field.type === "CURRENCY") {
    const numberValue = typeof input === "number" ? input : Number(textValue(input));
    if (!Number.isFinite(numberValue)) {
      return errorResult(`${label} must be a valid number.`);
    }
    if (validation?.min !== undefined && numberValue < validation.min) {
      return errorResult(`${label} must be at least ${validation.min}.`);
    }
    if (validation?.max !== undefined && numberValue > validation.max) {
      return errorResult(`${label} must be no greater than ${validation.max}.`);
    }
    return { valid: true, value: numberValue };
  }

  if (field.type === "DATE") {
    const value = textValue(input);
    if (!validCalendarDate(value)) {
      return errorResult(`${label} must be a valid date in YYYY-MM-DD format.`);
    }
    return { valid: true, value };
  }

  if (field.type === "DATETIME") {
    const value = textValue(input);
    if (
      !value.includes("T") ||
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ||
      Number.isNaN(new Date(value).getTime())
    ) {
      return errorResult(`${label} must be an ISO date and time with a timezone.`);
    }
    return { valid: true, value: new Date(value).toISOString() };
  }

  if (field.type === "CHECKBOX") {
    if (input === true || input === "true" || input === "on" || input === "1") {
      return { valid: true, value: true };
    }
    if (input === false || input === "false" || input === "off" || input === "0" || input === "") {
      return { valid: true, value: false };
    }
    return errorResult(`${label} must be true or false.`);
  }

  const options = readOptions(field);
  if (typeof options === "string") {
    return errorResult(options);
  }
  if (!options) {
    return errorResult(`${label} does not have valid select options.`);
  }

  if (field.type === "SELECT") {
    if (typeof input !== "string" || !options.includes(input)) {
      return errorResult(`${label} must be one of the configured options.`);
    }
    return { valid: true, value: input };
  }

  if (!Array.isArray(input) || input.some((value) => typeof value !== "string")) {
    return errorResult(`${label} must contain one or more selected options.`);
  }
  const values = [...new Set(input)];
  if (values.some((value) => !options.includes(value))) {
    return errorResult(`${label} contains an option that is not configured.`);
  }
  if (field.required && values.length === 0) {
    return errorResult(`${label} is required.`);
  }
  return { valid: true, value: values };
}

export type PaidAccessInput = {
  businessStatus: string;
  subscriptionStatus: string;
  trialDays: number;
  trialEndsAt?: string | null;
  now?: Date;
};

export function hasPaidOperationalAccess(input: PaidAccessInput) {
  if (!Number.isInteger(input.trialDays) || input.trialDays < 0) {
    return false;
  }
  if (
    input.businessStatus === "ACTIVE" &&
    input.subscriptionStatus === "ACTIVE"
  ) {
    return true;
  }
  if (
    input.businessStatus === "GRACE_PERIOD" &&
    input.subscriptionStatus === "GRACE_PERIOD"
  ) {
    return true;
  }
  if (
    input.businessStatus !== "PENDING_PAYMENT" ||
    input.subscriptionStatus !== "PENDING_PAYMENT" ||
    input.trialDays === 0
  ) {
    return false;
  }
  if (!input.trialEndsAt) {
    return true;
  }
  const trialEnd = new Date(input.trialEndsAt);
  const now = input.now ?? new Date();
  return !Number.isNaN(trialEnd.getTime()) && trialEnd.getTime() > now.getTime();
}

export function billingRestrictionDate(input: {
  dueDate: string;
  graceEndsAt: string | null;
}) {
  return input.graceEndsAt && input.graceEndsAt > input.dueDate
    ? input.graceEndsAt
    : input.dueDate;
}
