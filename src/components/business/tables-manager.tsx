"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";
import { TableExportMenu, TableImportForm } from "@/components/business/table-spreadsheet";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createFieldAction,
  createTableAction,
  deleteFieldAction,
  deleteTableAction,
  updateFieldAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";
import { FIELD_TYPE_LABELS, CUSTOM_FIELD_TYPES, type CustomFieldType } from "@/components/business/rules";
import {
  BUSINESS_PERMISSION_DEFINITIONS,
  FIELD_RESTRICTABLE_PERMISSION_KEYS,
  type BusinessPermissionKey,
} from "@/lib/permissions";

type Table = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fieldCount: number;
  recordCount: number;
};

type Field = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue: unknown;
  options: unknown;
  validation: unknown;
  restricted?: boolean;
  allowedPermissionKeys?: BusinessPermissionKey[];
};

function PermissionRestrictionOptions({
  selected,
}: {
  selected?: readonly string[];
}) {
  return (
    <fieldset className="sm:col-span-2 rounded-lg border border-emerald-100 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">
        Restrict visibility
      </legend>
      <p className="mb-3 text-xs text-slate-600">
        Leave every option unchecked to show this field to everyone who can open
        the table. Selecting one or more options restricts the field to members
        whose role holds at least one of those permissions. The restriction is
        enforced on the server for records, searches, and exports.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELD_RESTRICTABLE_PERMISSION_KEYS.map((permission) => (
          <label
            key={permission}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              name="allowedPermission"
              value={permission}
              defaultChecked={selected?.includes(permission) ?? false}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-emerald-950">{permission}</span>
              <span className="block text-xs text-slate-600">
                {BUSINESS_PERMISSION_DEFINITIONS[permission].description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TablesManager({
  businessId,
  tables,
  selectedTable,
  canCreateTable,
  canEditFields,
  canDeleteTable,
  canExportRecords,
}: {
  businessId: string;
  tables: Table[];
  selectedTable: (Table & { fields: Field[] }) | null;
  canCreateTable: boolean;
  canEditFields: boolean;
  canDeleteTable: boolean;
  canExportRecords: boolean;
}) {
  const [tableState, tableAction, tablePending] = useActionState(
    createTableAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const [fieldState, fieldAction, fieldPending] = useActionState(
    createFieldAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTableAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const [mode, setMode] = useState<"manual" | "import">("manual");

  return (
    <div className="space-y-8">
      {canCreateTable ? (
        <section className="rounded-xl border border-emerald-100 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMode(mode === "manual" ? "import" : "manual")}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-900"
            >
              {mode === "manual" ? "Import from spreadsheet" : "Create blank table"}
            </button>
            <p className="text-xs text-slate-600">
              Build a table by hand, or import an existing Excel/CSV file.
            </p>
          </div>
          {mode === "import" ? (
            <>
              <h2 className="mt-5 text-lg font-semibold text-emerald-950">
                Import a spreadsheet
              </h2>
              <TableImportForm businessId={businessId} />
            </>
          ) : (
            <>
              <h2 className="mt-5 text-lg font-semibold text-emerald-950">Create a custom table</h2>
              <form action={tableAction} className="mt-5 grid gap-5 sm:grid-cols-2" aria-busy={tablePending}>
                <TextField id="table-name" name="name" label="Table name" required error={tableState.fieldErrors?.name?.[0]} />
                <TextAreaField id="table-description" name="description" label="Description" />
                <div className="sm:col-span-2">
                  <ActionMessage state={tableState} />
                  <ActionSubmitButton pending={tablePending}>Create table</ActionSubmitButton>
                </div>
              </form>
            </>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-emerald-950">Custom tables</h2>
          {selectedTable && canDeleteTable ? (
            <form action={deleteAction} aria-busy={deletePending}>
              <input type="hidden" name="tableId" value={selectedTable.id} />
              <button
                type="submit"
                disabled={deletePending || selectedTable.recordCount > 0}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletePending ? "Deleting…" : "Delete selected table"}
              </button>
            </form>
          ) : null}
        </div>
        {tables.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
            No custom tables have been created.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Link
                key={table.id}
                href={`/business/${businessId}/tables?table=${table.id}`}
                className={`rounded-xl border p-4 transition hover:border-emerald-600 ${
                  table.id === selectedTable?.id
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-emerald-100 bg-white"
                }`}
              >
                <span className="block font-semibold text-emerald-950">{table.name}</span>
                <span className="mt-1 block text-xs text-slate-600">
                  {table.fieldCount} fields · {table.recordCount} records
                </span>
                {table.description ? (
                  <span className="mt-2 block text-sm text-slate-600">{table.description}</span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
        <ActionMessage state={deleteState} />
      </section>

      {selectedTable ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-emerald-950">Fields · {selectedTable.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Field values are stored as validated JSON data; no dynamic SQL is used.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TableExportMenu
                tableId={selectedTable.id}
                canExport={canExportRecords}
                tablePath={`/business/${encodeURIComponent(businessId)}/tables?table=${encodeURIComponent(selectedTable.id)}`}
              />
              <Link
                href={`/business/${businessId}/tables/${selectedTable.id}/new`}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-950"
              >
                Add record
              </Link>
            </div>
          </div>
          {canEditFields ? (
            <form action={fieldAction} className="space-y-5 rounded-xl border border-emerald-100 bg-white p-5" aria-busy={fieldPending}>
              <input type="hidden" name="tableId" value={selectedTable.id} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id="field-label" name="label" label="Field label" required error={fieldState.fieldErrors?.label?.[0]} />
                <TextField id="field-key" name="key" label="Stable key" hint="Generated from the label when blank." error={fieldState.fieldErrors?.key?.[0]} />
                <SelectField id="field-type" name="type" label="Field type" required defaultValue="SHORT_TEXT" error={fieldState.fieldErrors?.type?.[0]}>
                  {CUSTOM_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </SelectField>
                <TextField id="field-default" name="defaultValue" label="Default value" hint={'For multiple select fields, enter JSON such as ["one"].'} />
                <div className="sm:col-span-2">
                  <CheckboxField id="field-required" name="required" label="Required field" />
                </div>
                <TextAreaField id="field-options" name="options" label="Select options" hint='JSON array, for example ["Open","Closed"].' />
                <TextAreaField id="field-validation" name="validation" label="Validation" hint='JSON object, for example {"minLength":2,"maxLength":80}.' />
                <PermissionRestrictionOptions />
              </div>
              <ActionMessage state={fieldState} />
              <ActionSubmitButton pending={fieldPending}>Add field</ActionSubmitButton>
            </form>
          ) : null}
          <div className="space-y-3">
            {selectedTable.fields.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
                This table has no fields yet.
              </p>
            ) : (
              selectedTable.fields.map((field) => (
                <FieldRow key={field.id} businessId={businessId} tableId={selectedTable.id} field={field} canEdit={canEditFields} />
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function FieldRow({
  businessId,
  tableId,
  field,
  canEdit,
}: {
  businessId: string;
  tableId: string;
  field: Field;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateFieldAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFieldAction.bind(null, businessId),
    initialBusinessActionState,
  );

  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold text-emerald-950">{field.label}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {field.key} · {FIELD_TYPE_LABELS[field.type]} {field.required ? "· required" : ""}
            {field.restricted ? " · restricted visibility" : ""}
          </p>
        </div>
        {canEdit ? (
          <form action={deleteAction} aria-busy={deletePending}>
            <input type="hidden" name="tableId" value={tableId} />
            <input type="hidden" name="fieldId" value={field.id} />
            <button type="submit" disabled={deletePending} className="text-sm text-rose-300 disabled:opacity-40">
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          </form>
        ) : null}
      </div>
      {canEdit ? (
        <form action={action} className="mt-5 space-y-4" aria-busy={pending}>
          <input type="hidden" name="fieldId" value={field.id} />
          <input type="hidden" name="tableId" value={tableId} />
          <input type="hidden" name="currentType" value={field.type} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id={`${field.id}-label`} name="label" label="Label" defaultValue={field.label} required />
            <TextField id={`${field.id}-default`} name="defaultValue" label="Default value" defaultValue={jsonText(field.defaultValue)} />
            <div className="sm:col-span-2">
              <CheckboxField id={`${field.id}-required`} name="required" label="Required field" defaultChecked={field.required} />
            </div>
            <TextAreaField id={`${field.id}-options`} name="options" label="Select options" defaultValue={jsonText(field.options)} />
            <TextAreaField id={`${field.id}-validation`} name="validation" label="Validation" defaultValue={jsonText(field.validation)} />
            <PermissionRestrictionOptions selected={field.allowedPermissionKeys} />
          </div>
          <ActionMessage state={state} />
          <ActionSubmitButton pending={pending}>Save field</ActionSubmitButton>
        </form>
      ) : null}
      <ActionMessage state={deleteState} />
    </article>
  );
}
