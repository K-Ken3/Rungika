"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { createRecordAction } from "@/actions/business";
import { ArchiveRecordButton } from "@/components/business/archive-record-button";
import { initialBusinessActionState } from "@/lib/actions/business-state";
import { FIELD_TYPE_LABELS, type CustomFieldType } from "@/components/business/rules";

export type GridField = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: unknown;
};

export type GridRecord = {
  id: string;
  data: Record<string, unknown>;
  status: string;
  createdByName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

const BORDER = "border border-emerald-100";

const CELL = `${BORDER} px-3 py-2 align-middle whitespace-nowrap text-sm text-slate-700`;

const HEADER_CELL = `${BORDER} bg-emerald-50 px-3 py-2 text-left align-bottom text-sm font-semibold text-emerald-950 whitespace-nowrap`;

const GUTTER = `${BORDER} sticky left-0 z-20 w-12 bg-slate-100 px-2 py-2 text-center align-middle text-xs font-medium text-slate-500`;

function columnLetter(index: number): string {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function readOptions(options: unknown): string[] {
  return Array.isArray(options)
    ? options.filter((item): item is string => typeof item === "string")
    : [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DateValue({ value, type }: { value: string; type: CustomFieldType }) {
  if (type !== "DATETIME") return <span>{value}</span>;
  const date = new Date(value);
  return <span>{Number.isNaN(date.getTime()) ? value : date.toLocaleString()}</span>;
}

export function TableGrid({
  businessId,
  tableId,
  fields,
  records,
  page,
  pageSize,
  canCreateRecords,
  canEditRecords,
  canDeleteRecords,
  recordsBasePath,
}: {
  businessId: string;
  tableId: string;
  fields: GridField[];
  records: GridRecord[];
  page: number;
  pageSize: number;
  canCreateRecords: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
  recordsBasePath: string;
}) {
  const [addState, addAction, addPending] = useActionState(
    createRecordAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const formId = `inline-add-${tableId}`;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState.status === "success") {
      formRef.current?.reset();
    }
  }, [addState.status]);

  const dataColumns = fields.length;
  const statusColumn = columnLetter(dataColumns);

  function addRowCell(field: GridField) {
    const options = readOptions(field.options);
    const common = `form=${formId} w-full min-w-[9rem] rounded border border-emerald-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500`;
    if (field.type === "CHECKBOX") {
      return (
        <label className="flex items-center justify-center">
          <input form={formId} type="checkbox" name={`field:${field.key}`} className="h-4 w-4" />
        </label>
      );
    }
    if (field.type === "SELECT") {
      return (
        <select form={formId} name={`field:${field.key}`} className={common} aria-label={field.label} defaultValue="">
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === "MULTI_SELECT") {
      return (
        <select form={formId} name={`field:${field.key}`} multiple size={2} className={common} aria-label={field.label}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
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
    const step = field.type === "CURRENCY" ? "0.01" : field.type === "NUMBER" ? "any" : undefined;
    return (
      <input
        form={formId}
        type={type}
        step={step}
        name={`field:${field.key}`}
        placeholder={field.required ? `${field.label} *` : field.label}
        className={common}
        aria-label={field.label}
      />
    );
  }

  return (
    <div className="space-y-3">
      <form ref={formRef} id={formId} action={addAction} className="hidden" aria-hidden="true">
        <input type="hidden" name="tableId" value={tableId} />
      </form>

      <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className={`${BORDER} sticky top-0 left-0 z-40 w-12 bg-slate-100 px-2 py-1 text-center text-xs font-normal text-slate-400`}>
                #
              </th>
              {fields.map((field, index) => (
                <th
                  key={`letter-${field.id}`}
                  scope="col"
                  className={`${BORDER} sticky top-0 z-20 bg-slate-100 px-3 py-1 text-center text-xs font-normal text-slate-400`}
                >
                  {columnLetter(index)}
                </th>
              ))}
              <th scope="col" className={`${BORDER} sticky top-0 z-20 bg-slate-100 px-3 py-1 text-center text-xs font-normal text-slate-400`}>
                {statusColumn}
              </th>
              <th scope="col" className={`${BORDER} sticky top-0 z-20 bg-slate-100 px-3 py-1 text-center text-xs font-normal text-slate-400`}>
                {columnLetter(dataColumns + 1)}
              </th>
            </tr>
            <tr>
              <th scope="col" className={`${GUTTER} top-[27px] z-40`}>
                Row
              </th>
              {fields.map((field) => (
                <th key={field.id} scope="col" className={`${HEADER_CELL} sticky top-[27px] z-20`}>
                  <span className="block">{field.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {FIELD_TYPE_LABELS[field.type]}
                    {field.required ? " · required" : ""}
                  </span>
                </th>
              ))}
              <th scope="col" className={`${HEADER_CELL} sticky top-[27px] z-20`}>
                Status
              </th>
              <th scope="col" className={`${HEADER_CELL} sticky top-[27px] z-20`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={dataColumns + 3} className={`${CELL} bg-slate-50 text-center text-slate-500`}>
                  No rows yet. Add one below.
                </td>
              </tr>
            ) : (
              records.map((record, index) => (
                <tr key={record.id} className="group hover:bg-emerald-50/60">
                  <td className={GUTTER}>{(page - 1) * pageSize + index + 1}</td>
                  {fields.map((field) => {
                    const raw = record.data[field.key];
                    const display = displayValue(raw);
                    return (
                      <td key={field.id} className={CELL} title={display}>
                        {typeof raw === "string" && field.type === "DATETIME" ? (
                          <DateValue value={raw} type={field.type} />
                        ) : display}
                      </td>
                    );
                  })}
                  <td className={CELL}>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        record.status === "ARCHIVED"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className={`${CELL} text-right`}>
                    <div className="flex items-center justify-end gap-3">
                      {canEditRecords ? (
                        <Link
                          className="text-sm font-semibold text-emerald-700 hover:underline"
                          href={`${recordsBasePath}/${encodeURIComponent(tableId)}/${encodeURIComponent(record.id)}`}
                        >
                          Edit
                        </Link>
                      ) : null}
                      {canDeleteRecords && record.status === "ACTIVE" ? (
                        <ArchiveRecordButton businessId={businessId} tableId={tableId} recordId={record.id} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {canCreateRecords && fields.length > 0 ? (
            <tfoot>
              <tr className="bg-emerald-50/40">
                <td className={GUTTER}>
                  <span aria-hidden="true" className="text-emerald-600">
                    +
                  </span>
                </td>
                {fields.map((field) => (
                  <td key={field.id} className={`${BORDER} px-2 py-2 align-top`}>
                    {addRowCell(field)}
                  </td>
                ))}
                <td className={`${BORDER} px-2 py-2 align-top text-xs text-slate-500`}>Active</td>
                <td className={`${BORDER} px-2 py-2 text-right align-top`}>
                  <button
                    type="submit"
                    form={formId}
                    disabled={addPending}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addPending ? "Adding…" : "Add row"}
                  </button>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {addState.message ? (
        <p
          role={addState.status === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            addState.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-300 bg-emerald-100 text-emerald-800"
          }`}
        >
          {addState.message}
        </p>
      ) : null}
    </div>
  );
}
