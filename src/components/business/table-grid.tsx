"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { createRecordAction, updateRecordCellAction } from "@/actions/business";
import { ArchiveRecordButton } from "@/components/business/archive-record-button";
import { initialBusinessActionState } from "@/lib/actions/business-state";
import { type CustomFieldType } from "@/components/business/rules";

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

type FormEntry = { name: string; value: string };
type CellEdit = { recordId: string; key: string };
type HistoryEntry = { recordId: string; key: string; from: FormEntry[]; to: FormEntry[] };
type Draft = string | string[] | boolean;

const BORDER = "border border-emerald-100";

const CELL = `${BORDER} px-3 py-2 align-middle whitespace-nowrap text-sm text-slate-700`;

const HEADER_CELL = `${BORDER} bg-emerald-50 px-3 py-2 text-left align-middle text-sm font-semibold text-emerald-950 whitespace-nowrap`;

const GUTTER = `${BORDER} sticky left-0 z-20 w-12 bg-slate-100 px-2 py-2 text-center align-middle text-xs font-medium text-slate-500`;

const MIN_COLUMN_WIDTH = 96;

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toEditValue(type: CustomFieldType, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "boolean") return raw ? "true" : "";
  if (typeof raw === "object") return JSON.stringify(raw);
  const text = String(raw);
  if (type === "DATETIME" && text) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  }
  return text;
}

function initialDraft(field: GridField, raw: unknown): Draft {
  if (field.type === "CHECKBOX") return raw === true;
  if (field.type === "MULTI_SELECT") {
    if (Array.isArray(raw)) return raw.map(String);
    return raw === null || raw === undefined || raw === "" ? [] : [String(raw)];
  }
  return toEditValue(field.type, raw);
}

function entriesFor(field: GridField, value: unknown): FormEntry[] {
  const name = `field:${field.key}`;
  if (field.type === "MULTI_SELECT") {
    const list = Array.isArray(value)
      ? value.map(String)
      : value === null || value === undefined || value === ""
        ? []
        : [String(value)];
    return list.map((entry) => ({ name, value: entry }));
  }
  if (field.type === "CHECKBOX") {
    return value === true || value === "on" ? [{ name, value: "on" }] : [];
  }
  if (value === null || value === undefined) return [];
  if (typeof value === "boolean") return value ? [{ name, value: "on" }] : [];
  if (Array.isArray(value)) return value.map((entry) => ({ name, value: String(entry) }));
  if (typeof value === "object") return [{ name, value: JSON.stringify(value) }];
  return [{ name, value: String(value) }];
}

function inputTypeFor(type: CustomFieldType): string {
  if (type === "NUMBER" || type === "CURRENCY") return "number";
  if (type === "DATE") return "date";
  if (type === "DATETIME") return "datetime-local";
  if (type === "EMAIL") return "email";
  if (type === "URL") return "url";
  if (type === "PHONE") return "tel";
  return "text";
}

function DateValue({ value, type }: { value: string; type: CustomFieldType }) {
  if (type !== "DATETIME") return <span>{value}</span>;
  const date = new Date(value);
  return <span>{Number.isNaN(date.getTime()) ? value : date.toLocaleString()}</span>;
}

function SortIndicator({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  if (!active) return <span className="ml-1 text-xs text-slate-400">↕</span>;
  return (
    <span className="ml-1 text-xs text-emerald-700" aria-hidden="true">
      {order === "asc" ? "▲" : "▼"}
    </span>
  );
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
  sort,
  order,
  sortHref,
  filterKey,
  filterValue,
  filterHref,
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
  sort: string;
  order: "asc" | "desc";
  sortHref: (key: string) => string;
  filterKey: string;
  filterValue: string;
  filterHref: (key: string, value: string) => string;
}) {
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState(
    createRecordAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const formId = `inline-add-${tableId}`;
  const formRef = useRef<HTMLFormElement>(null);

  const [editing, setEditing] = useState<CellEdit | null>(null);
  const [draft, setDraft] = useState<Draft>("");
  const [cellError, setCellError] = useState<string | null>(null);
  const [isSavingCell, startSave] = useTransition();
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    if (addState.status === "success") {
      formRef.current?.reset();
    }
  }, [addState.status]);

  const dataColumns = fields.length;

  function applyEntries(
    recordId: string,
    key: string,
    entries: FormEntry[],
    onDone?: (ok: boolean) => void,
  ) {
    const payload = new FormData();
    payload.set("tableId", tableId);
    payload.set("recordId", recordId);
    payload.set("key", key);
    for (const entry of entries) {
      payload.append(entry.name, entry.value);
    }
    setCellError(null);
    startSave(async () => {
      try {
        const result = await updateRecordCellAction(businessId, initialBusinessActionState, payload);
        if (result.status === "success") {
          router.refresh();
          onDone?.(true);
          return;
        }
        setCellError(result.message ?? "That value could not be saved.");
        onDone?.(false);
      } catch {
        setCellError("We could not save that cell. Please try again.");
        onDone?.(false);
      }
    });
  }

  function startEditing(record: GridRecord, field: GridField) {
    if (!canEditRecords) return;
    setCellError(null);
    setEditing({ recordId: record.id, key: field.key });
    setDraft(initialDraft(field, record.data[field.key]));
  }

  function cancelEdit() {
    setEditing(null);
    setCellError(null);
  }

  function commitEdit() {
    if (!editing || isSavingCell) return;
    const field = fields.find((entry) => entry.key === editing.key);
    const record = records.find((entry) => entry.id === editing.recordId);
    if (!field || !record) {
      setEditing(null);
      return;
    }
    const from = entriesFor(field, record.data[field.key]);
    const to = entriesFor(field, draft);
    if (JSON.stringify(from) === JSON.stringify(to)) {
      setEditing(null);
      return;
    }
    applyEntries(record.id, field.key, to, (ok) => {
      if (!ok) return;
      setUndoStack((stack) => [...stack, { recordId: record.id, key: field.key, from, to }].slice(-50));
      setRedoStack([]);
      setEditing(null);
    });
  }

  function undo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || isSavingCell) return;
    applyEntries(entry.recordId, entry.key, entry.from, (ok) => {
      if (!ok) return;
      setUndoStack((stack) => stack.slice(0, -1));
      setRedoStack((stack) => [...stack, entry]);
    });
  }

  function redo() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry || isSavingCell) return;
    applyEntries(entry.recordId, entry.key, entry.to, (ok) => {
      if (!ok) return;
      setRedoStack((stack) => stack.slice(0, -1));
      setUndoStack((stack) => [...stack, entry]);
    });
  }

  function moveFocus(currentRow: number, currentColumn: number, deltaRow: number, deltaColumn: number) {
    const nextRow = currentRow + deltaRow;
    const nextColumn = currentColumn + deltaColumn;
    if (nextRow < 0 || nextRow >= records.length || nextColumn < 0 || nextColumn >= dataColumns) return;
    const target = document.querySelector<HTMLElement>(`[data-cell="${nextRow}:${nextColumn}"]`);
    target?.focus();
  }

  function onCellNav(event: React.KeyboardEvent<HTMLElement>, row: number, column: number) {
    const key = event.key;
    if (key === "ArrowUp") {
      event.preventDefault();
      moveFocus(row, column, -1, 0);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      moveFocus(row, column, 1, 0);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(row, column, 0, -1);
    } else if (key === "ArrowRight") {
      event.preventDefault();
      moveFocus(row, column, 0, 1);
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const typing = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.altKey || typing) return;
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      undo();
    } else if (key === "y") {
      event.preventDefault();
      redo();
    }
  }

  function beginResize(event: React.PointerEvent<HTMLSpanElement>, fieldId: string) {
    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest("th");
    const startWidth = header instanceof HTMLElement ? header.offsetWidth : MIN_COLUMN_WIDTH;
    const startX = event.clientX;
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setWidths((current) => ({ ...current, [fieldId]: next }));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function columnStyle(fieldId: string) {
    const width = widths[fieldId];
    return width ? { width, minWidth: width } : undefined;
  }

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
    const step = field.type === "CURRENCY" ? "0.01" : field.type === "NUMBER" ? "any" : undefined;
    return (
      <input
        form={formId}
        type={inputTypeFor(field.type)}
        step={step}
        name={`field:${field.key}`}
        placeholder={field.required ? `${field.label} *` : field.label}
        className={common}
        aria-label={field.label}
      />
    );
  }

  function editControl(field: GridField, record: GridRecord) {
    const options = readOptions(field.options);
    const common =
      "w-full min-w-[9rem] rounded border border-emerald-500 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500";

    if (field.type === "CHECKBOX") {
      return (
        <label className="flex items-center justify-center py-1">
          <input
            type="checkbox"
            autoFocus
            checked={draft === true}
            onChange={(event) => setDraft(event.target.checked)}
            onBlur={commitEdit}
            className="h-4 w-4"
            aria-label={field.label}
          />
        </label>
      );
    }

    if (field.type === "SELECT") {
      return (
        <select
          autoFocus
          className={common}
          value={typeof draft === "string" ? draft : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEdit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={commitEdit}
          aria-label={field.label}
        >
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
      const selected = Array.isArray(draft) ? draft : [];
      return (
        <select
          autoFocus
          multiple
          size={Math.min(4, Math.max(2, options.length))}
          className={common}
          value={selected}
          onChange={(event) =>
            setDraft(Array.from(event.target.selectedOptions).map((option) => option.value))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEdit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={commitEdit}
          aria-label={field.label}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "LONG_TEXT") {
      return (
        <textarea
          autoFocus
          rows={4}
          className={common}
          value={typeof draft === "string" ? draft : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={commitEdit}
          aria-label={field.label}
        />
      );
    }

    const step = field.type === "CURRENCY" ? "0.01" : field.type === "NUMBER" ? "any" : undefined;
    return (
      <input
        autoFocus
        type={inputTypeFor(field.type)}
        step={step}
        className={common}
        value={typeof draft === "string" ? draft : ""}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEdit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
          }
        }}
        onBlur={commitEdit}
        aria-label={`${field.label}, row ${records.indexOf(record) + 1}`}
      />
    );
  }

  return (
    <div className="space-y-3" onKeyDown={onGridKeyDown}>
      <form ref={formRef} id={formId} action={addAction} className="hidden" aria-hidden="true">
        <input type="hidden" name="tableId" value={tableId} />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {canEditRecords
            ? "Click a cell to edit. Enter saves, Esc cancels, arrows move between cells."
            : "You have view-only access to these rows."}
        </p>
        {canEditRecords && (undoStack.length > 0 || redoStack.length > 0) ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0 || isSavingCell}
              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0 || isSavingCell}
              className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>
          </div>
        ) : null}
      </div>

      {cellError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {cellError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-40 w-12 border border-emerald-100 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-950"
                aria-sort={sort === "createdAt" ? (order === "asc" ? "ascending" : "descending") : "none"}
              >
                <Link href={sortHref("createdAt")} className="hover:underline" title="Sort by date added">
                  #
                  <SortIndicator active={sort === "createdAt"} order={order} />
                </Link>
              </th>
              {fields.map((field) => (
                <th
                  key={field.id}
                  scope="col"
                  style={columnStyle(field.id)}
                  className={`${HEADER_CELL} sticky top-0 z-30 group`}
                  aria-sort={sort === field.key ? (order === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span className="inline-flex items-center">
                    <Link href={sortHref(field.key)} className="hover:underline">
                      {field.label}
                      {field.required ? <span className="ml-0.5 text-rose-500">*</span> : null}
                      <SortIndicator active={sort === field.key} order={order} />
                    </Link>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${field.label}`}
                      onPointerDown={(event) => beginResize(event, field.id)}
                      className="ml-1 -mr-2 w-2 cursor-col-resize self-stretch rounded bg-transparent text-slate-300 hover:bg-emerald-300"
                    >
                      │
                    </span>
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className={`${HEADER_CELL} sticky top-0 z-30`}
                aria-sort={sort === "status" ? (order === "asc" ? "ascending" : "descending") : "none"}
              >
                <Link href={sortHref("status")} className="hover:underline">
                  Status
                  <SortIndicator active={sort === "status"} order={order} />
                </Link>
              </th>
              <th scope="col" className={`${HEADER_CELL} sticky top-0 z-30`}>
                Actions
              </th>
            </tr>
            <tr>
              <td className={`${GUTTER} bg-slate-50`} />
              {fields.map((field) => (
                <td
                  key={field.id}
                  style={columnStyle(field.id)}
                  className={`${BORDER} bg-slate-50 px-2 py-1.5 align-middle`}
                >
                  <form
                    key={`${field.id}-${filterKey}-${filterValue}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get(`filter:${field.key}`);
                      router.replace(filterHref(field.key, typeof value === "string" ? value : ""));
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      name={`filter:${field.key}`}
                      defaultValue={filterKey === field.key ? filterValue : ""}
                      placeholder="Filter"
                      aria-label={`Filter ${field.label}`}
                      className="w-full min-w-[5rem] rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500"
                    />
                    <button type="submit" className="sr-only">
                      Apply filter
                    </button>
                  </form>
                </td>
              ))}
              <td className={`${BORDER} bg-slate-50 px-2 py-1.5`} />
              <td className={`${BORDER} bg-slate-50 px-2 py-1.5`} />
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
                  {fields.map((field, columnIndex) => {
                    const raw = record.data[field.key];
                    const display = displayValue(raw);
                    const isEditing = editing?.recordId === record.id && editing.key === field.key;
                    const width = columnStyle(field.id);
                    if (isEditing) {
                      return (
                        <td
                          key={field.id}
                          style={width}
                          className={`${BORDER} min-w-[9rem] bg-emerald-50/80 px-2 py-1 align-middle`}
                        >
                          {editControl(field, record)}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={field.id}
                        style={width}
                        className={`${CELL} p-0`}
                        title={display}
                      >
                        {canEditRecords ? (
                          <button
                            type="button"
                            data-cell={`${index}:${columnIndex}`}
                            onClick={() => startEditing(record, field)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                startEditing(record, field);
                              } else {
                                onCellNav(event, index, columnIndex);
                              }
                            }}
                            className="block w-full min-w-[9rem] truncate px-3 py-2 text-left outline-none focus:ring-1 focus:ring-emerald-500 focus:ring-inset"
                          >
                            {typeof raw === "string" && field.type === "DATETIME" ? (
                              <DateValue value={raw} type={field.type} />
                            ) : (
                              display
                            )}
                          </button>
                        ) : (
                          <span className="block truncate px-3 py-2">
                            {typeof raw === "string" && field.type === "DATETIME" ? (
                              <DateValue value={raw} type={field.type} />
                            ) : (
                              display
                            )}
                          </span>
                        )}
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
                  <td key={field.id} style={columnStyle(field.id)} className={`${BORDER} px-2 py-2 align-top`}>
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
