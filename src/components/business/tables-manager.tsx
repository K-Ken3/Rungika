"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";
import { TableExportMenu, TableImportForm } from "@/components/business/table-spreadsheet";
import { TableGrid } from "@/components/business/table-grid";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
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

type RecordItem = {
  id: string;
  data: Record<string, unknown>;
  status: string;
  createdByName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type Panel = "create" | "import" | "fields" | null;

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

function ToolbarButton({
  panel,
  current,
  onClick,
  children,
}: {
  panel: Panel;
  current: Panel;
  onClick: () => void;
  children: ReactNode;
}) {
  const active = panel === current;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
      }`}
    >
      {children}
    </button>
  );
}

export function TablesManager({
  businessId,
  tables,
  selectedTable,
  records,
  pagination,
  query,
  canCreateTable,
  canEditFields,
  canDeleteTable,
  canExportRecords,
  canCreateRecords,
  canEditRecords,
  canDeleteRecords,
}: {
  businessId: string;
  tables: Table[];
  selectedTable: (Table & { fields: Field[] }) | null;
  records: RecordItem[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  query: { search: string; status: "ACTIVE" | "ARCHIVED" | "ALL" };
  canCreateTable: boolean;
  canEditFields: boolean;
  canDeleteTable: boolean;
  canExportRecords: boolean;
  canCreateRecords: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
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
  const [panel, setPanel] = useState<Panel>(null);

  const base = `/business/${encodeURIComponent(businessId)}/tables`;

  const tabHref = (tableId: string) => {
    const next = new URLSearchParams();
    next.set("table", tableId);
    if (query.search) next.set("search", query.search);
    if (query.status !== "ACTIVE") next.set("status", query.status);
    return `${base}?${next.toString()}`;
  };

  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (selectedTable) next.set("table", selectedTable.id);
    if (query.search) next.set("search", query.search);
    if (query.status !== "ACTIVE") next.set("status", query.status);
    next.set("page", String(nextPage));
    return `${base}?${next.toString()}`;
  };

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
        <span className="mr-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Sheet
        </span>
        <span className="mr-2 max-w-[14rem] truncate text-sm font-semibold text-emerald-950">
          {selectedTable ? selectedTable.name : "No table selected"}
        </span>

        {selectedTable ? (
          <form className="flex flex-wrap items-center gap-2" method="get">
            <input type="hidden" name="table" value={selectedTable.id} />
            <input
              type="search"
              name="search"
              defaultValue={query.search}
              placeholder="Search rows"
              aria-label="Search rows"
              className="w-44 rounded-lg border border-emerald-200 bg-slate-50 px-3 py-2 text-sm text-emerald-950"
            />
            <select
              name="status"
              defaultValue={query.status}
              aria-label="Row status"
              className="rounded-lg border border-emerald-200 bg-slate-50 px-3 py-2 text-sm text-emerald-950"
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
              <option value="ALL">All</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
            >
              Apply
            </button>
          </form>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {selectedTable ? (
            <TableExportMenu
              tableId={selectedTable.id}
              canExport={canExportRecords}
              tablePath={`${base}?table=${encodeURIComponent(selectedTable.id)}`}
            />
          ) : null}
          {canCreateTable ? (
            <>
              <ToolbarButton panel="import" current={panel} onClick={() => toggle("import")}>
                Upload file
              </ToolbarButton>
              <ToolbarButton panel="create" current={panel} onClick={() => toggle("create")}>
                New table
              </ToolbarButton>
            </>
          ) : null}
          {selectedTable && canEditFields ? (
            <ToolbarButton panel="fields" current={panel} onClick={() => toggle("fields")}>
              Fields
            </ToolbarButton>
          ) : null}
        </div>
      </div>

      {panel === "import" && canCreateTable ? (
        <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-950">Import a spreadsheet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Import an existing Excel or CSV file. A new table is created from the
            first sheet.
          </p>
          <TableImportForm businessId={businessId} />
        </section>
      ) : null}

      {panel === "create" && canCreateTable ? (
        <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-950">Create a custom table</h2>
          <form action={tableAction} className="mt-5 grid gap-5 sm:grid-cols-2" aria-busy={tablePending}>
            <TextField id="table-name" name="name" label="Table name" required error={tableState.fieldErrors?.name?.[0]} />
            <TextAreaField id="table-description" name="description" label="Description" />
            <div className="sm:col-span-2">
              <ActionMessage state={tableState} />
              <ActionSubmitButton pending={tablePending}>Create table</ActionSubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {panel === "fields" && selectedTable && canEditFields ? (
        <section className="space-y-4 rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">Columns · {selectedTable.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Field values are stored as validated JSON data; no dynamic SQL is used.
            </p>
          </div>
          <form action={fieldAction} className="space-y-5" aria-busy={fieldPending}>
            <input type="hidden" name="tableId" value={selectedTable.id} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="field-label" name="label" label="Column label" required error={fieldState.fieldErrors?.label?.[0]} />
              <TextField id="field-key" name="key" label="Stable key" hint="Generated from the label when blank." error={fieldState.fieldErrors?.key?.[0]} />
              <SelectField id="field-type" name="type" label="Column type" required defaultValue="SHORT_TEXT" error={fieldState.fieldErrors?.type?.[0]}>
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
            <ActionSubmitButton pending={fieldPending}>Add column</ActionSubmitButton>
          </form>
          <div className="space-y-3">
            {selectedTable.fields.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
                This table has no columns yet.
              </p>
            ) : (
              selectedTable.fields.map((field) => (
                <FieldRow key={field.id} businessId={businessId} tableId={selectedTable.id} field={field} canEdit={canEditFields} />
              ))
            )}
          </div>
        </section>
      ) : null}

      {selectedTable ? (
        <section className="space-y-3">
          {selectedTable.fields.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              {canEditFields ? "Add columns before creating rows." : "No columns on this table are available to your role."}
            </p>
          ) : (
            <TableGrid
              businessId={businessId}
              tableId={selectedTable.id}
              fields={selectedTable.fields}
              records={records}
              page={pagination.page}
              pageSize={pagination.pageSize}
              canCreateRecords={canCreateRecords}
              canEditRecords={canEditRecords}
              canDeleteRecords={canDeleteRecords}
              recordsBasePath={base}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {pagination.total} row{pagination.total === 1 ? "" : "s"}
              {query.search ? ` matching “${query.search}”` : ""}
            </p>
            <div className="flex items-center gap-4">
              {canCreateRecords ? (
                <Link
                  href={`${base}/${encodeURIComponent(selectedTable.id)}/new`}
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Open full form
                </Link>
              ) : null}
              {pagination.pageCount > 1 ? (
                <nav aria-label="Row pages" className="flex items-center gap-4">
                  <Link
                    aria-disabled={pagination.page <= 1}
                    className={`text-sm ${pagination.page <= 1 ? "pointer-events-none text-slate-400" : "text-emerald-700 hover:underline"}`}
                    href={pageHref(Math.max(1, pagination.page - 1))}
                  >
                    Previous
                  </Link>
                  <span className="text-sm text-slate-600">
                    Page {pagination.page} of {pagination.pageCount}
                  </span>
                  <Link
                    aria-disabled={pagination.page >= pagination.pageCount}
                    className={`text-sm ${pagination.page >= pagination.pageCount ? "pointer-events-none text-slate-400" : "text-emerald-700 hover:underline"}`}
                    href={pageHref(Math.min(pagination.pageCount, pagination.page + 1))}
                  >
                    Next
                  </Link>
                </nav>
              ) : null}
            </div>
          </div>

          {canDeleteTable ? (
            <div className="flex flex-wrap items-center gap-3">
              <form action={deleteAction} aria-busy={deletePending}>
                <input type="hidden" name="tableId" value={selectedTable.id} />
                <button
                  type="submit"
                  disabled={deletePending || selectedTable.recordCount > 0}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletePending ? "Deleting…" : "Delete this table"}
                </button>
              </form>
              {selectedTable.recordCount > 0 ? (
                <span className="text-xs text-slate-500">Archive all rows before deleting.</span>
              ) : null}
              <ActionMessage state={deleteState} />
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-white p-10 text-center text-sm text-slate-600">
          {tables.length === 0
            ? "No tables yet. Create one or upload a spreadsheet to get started."
            : "Select a sheet tab below to open a table."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t-2 border-emerald-100 pt-2">
        {tables.map((table) => {
          const active = table.id === selectedTable?.id;
          return (
            <Link
              key={table.id}
              href={tabHref(table.id)}
              className={`rounded-t-lg border border-b-0 px-3 py-1.5 text-sm transition ${
                active
                  ? "border-emerald-300 bg-white font-semibold text-emerald-900"
                  : "border-transparent bg-slate-100 text-slate-600 hover:bg-emerald-50"
              }`}
            >
              {table.name}
              <span className="ml-2 text-xs text-slate-400">{table.recordCount}</span>
            </Link>
          );
        })}
        {canCreateTable ? (
          <>
            <button
              type="button"
              onClick={() => toggle("create")}
              className="rounded-t-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              aria-label="New table"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => toggle("import")}
              className="rounded-t-lg border border-transparent px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              Upload
            </button>
          </>
        ) : null}
      </div>
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
          <ActionSubmitButton pending={pending}>Save column</ActionSubmitButton>
        </form>
      ) : null}
      <ActionMessage state={deleteState} />
    </article>
  );
}
