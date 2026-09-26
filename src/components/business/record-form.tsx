"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createRecordAction,
  initialBusinessActionState,
  updateRecordAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";
import { FIELD_TYPE_LABELS, type CustomFieldType } from "@/components/business/rules";

type Field = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue: unknown;
  options: unknown;
};

export function RecordForm({
  businessId,
  tableId,
  tableName,
  fields,
  recordId,
  recordData,
}: {
  businessId: string;
  tableId: string;
  tableName: string;
  fields: Field[];
  recordId?: string;
  recordData?: Record<string, unknown>;
}) {
  const action = recordId
    ? updateRecordAction.bind(null, businessId)
    : createRecordAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState(action, initialBusinessActionState);
  const values = recordData ?? {};

  return (
    <form action={formAction} className="space-y-6" aria-busy={pending}>
      <input type="hidden" name="tableId" value={tableId} />
      {recordId ? <input type="hidden" name="recordId" value={recordId} /> : null}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-950">{recordId ? "Edit record" : "New record"}</h1>
          <p className="mt-1 text-sm text-slate-600">{tableName}</p>
        </div>
        <Link href={`/business/${businessId}/tables/${tableId}`} className="text-sm text-emerald-700">
          Back to records
        </Link>
      </div>
      {fields.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Add at least one field to this table before creating a record.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <RecordInput
              key={field.id}
              field={field}
              value={values[field.key] ?? field.defaultValue}
              error={state.fieldErrors?.[field.key]?.[0]}
            />
          ))}
        </div>
      )}
      <ActionMessage state={state} />
      <ActionSubmitButton pending={pending} disabled={fields.length === 0}>
        {recordId ? "Save record" : "Create record"}
      </ActionSubmitButton>
    </form>
  );
}

function RecordInput({
  field,
  value,
  error,
}: {
  field: Field;
  value: unknown;
  error?: string;
}) {
  const id = `record-${field.id}`;
  const label = `${field.label}${field.required ? " *" : ""}`;
  const stringValue = value === null || value === undefined ? "" : String(value);
  const options = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
  const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

  if (field.type === "LONG_TEXT") {
    return (
      <div className="sm:col-span-2">
        <TextAreaField id={id} name={`field:${field.key}`} label={label} defaultValue={stringValue} required={field.required} error={error} />
      </div>
    );
  }
  if (field.type === "CHECKBOX") {
    return (
      <div className="sm:col-span-2">
        <CheckboxField id={id} name={`field:${field.key}`} label={label} defaultChecked={value === true || value === "true"} />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    );
  }
  if (field.type === "SELECT") {
    return (
      <SelectField id={id} name={`field:${field.key}`} label={label} defaultValue={stringValue} required={field.required} error={error}>
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    );
  }
  if (field.type === "MULTI_SELECT") {
    return (
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium text-slate-800">{label}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <CheckboxField
              key={option}
              id={`${id}-${option}`}
              name={`field:${field.key}`}
              value={option}
              label={option}
              defaultChecked={selectedValues.includes(option)}
            />
          ))}
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </fieldset>
    );
  }
  if (field.type === "FILE") {
    return (
      <TextField
        id={id}
        name={`field:${field.key}`}
        label={label}
        defaultValue={stringValue}
        required={field.required}
        hint="Storage upload is not connected. Enter an existing safe object key only; do not upload file bytes here."
        error={error}
      />
    );
  }
  const type =
    field.type === "NUMBER" || field.type === "CURRENCY"
      ? "number"
      : field.type === "DATE"
        ? "date"
        : field.type === "DATETIME"
          ? "datetime-local"
          : field.type === "EMAIL"
            ? "email"
            : field.type === "URL"
              ? "url"
              : field.type === "PHONE"
                ? "tel"
                : "text";
  const inputValue =
    field.type === "DATETIME" && stringValue
      ? new Date(stringValue).toISOString().slice(0, 16)
      : stringValue;
  return (
    <TextField
      id={id}
      name={`field:${field.key}`}
      label={`${label} · ${FIELD_TYPE_LABELS[field.type]}`}
      type={type}
      step={field.type === "CURRENCY" ? "0.01" : field.type === "NUMBER" ? "any" : undefined}
      defaultValue={inputValue}
      required={field.required}
      error={error}
    />
  );
}
