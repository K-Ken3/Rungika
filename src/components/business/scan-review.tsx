"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import {
  importScanAction,
  saveScanEditsAction,
  type ScanActionState,
} from "@/actions/scan";
import { ActionMessage, ActionSubmitButton } from "@/components/business/form-controls";
import { UNCERTAIN_CONFIDENCE_THRESHOLD } from "@/lib/ocr/normalize";

export type ReviewCell = {
  value: string;
  confidence: number | null;
  uncertain: boolean;
  note: string | null;
};

export type ReviewColumn = {
  label: string;
  confidence: number | null;
};

export type ImportTarget = {
  id: string;
  name: string;
  fields: Array<{ key: string; label: string; type: string; required: boolean }>;
};

const initialState: ScanActionState = { status: "idle" };

function emptyCell(): ReviewCell {
  return { value: "", confidence: null, uncertain: false, note: null };
}

function cellIsUncertain(cell: ReviewCell): boolean {
  if (cell.uncertain) {
    return true;
  }
  return cell.confidence !== null && cell.confidence < UNCERTAIN_CONFIDENCE_THRESHOLD;
}

function confidenceText(cell: ReviewCell): string | null {
  if (cell.confidence === null) {
    return cell.note ?? null;
  }
  return `${Math.round(cell.confidence * 100)}%${cell.note ? ` · ${cell.note}` : ""}`;
}

function guessMapping(columns: ReviewColumn[], target: ImportTarget | undefined): Record<number, string> {
  if (!target) {
    return {};
  }
  const mapping: Record<number, string> = {};
  columns.forEach((column, index) => {
    const wanted = column.label.trim().toLowerCase();
    const exact = target.fields.find((field) => field.label.trim().toLowerCase() === wanted);
    const partial =
      exact ??
      target.fields.find(
        (field) =>
          field.label.trim().toLowerCase().includes(wanted) ||
          wanted.includes(field.label.trim().toLowerCase()),
      );
    if (partial) {
      mapping[index] = partial.key;
    }
  });
  return mapping;
}

export function ScanReview({
  businessId,
  scanId,
  initialTitle,
  initialColumns,
  initialRows,
  warnings,
  provider,
  targets,
  defaultTableName,
  canImport,
}: {
  businessId: string;
  scanId: string;
  initialTitle: string | null;
  initialColumns: ReviewColumn[];
  initialRows: ReviewCell[][];
  warnings: string[];
  provider: string;
  targets: ImportTarget[];
  defaultTableName: string;
  canImport: boolean;
}) {
  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(
    saveScanEditsAction.bind(null, businessId),
    initialState,
  );
  const [importState, importAction, importPending] = useActionState(
    importScanAction.bind(null, businessId),
    initialState,
  );

  const [title, setTitle] = useState(initialTitle ?? "");
  const [columns, setColumns] = useState<ReviewColumn[]>(
    initialColumns.length > 0 ? initialColumns : [{ label: "Column 1", confidence: null }],
  );
  const [rows, setRows] = useState<ReviewCell[][]>(initialRows);
  const [mode, setMode] = useState<"NEW_TABLE" | "EXISTING_TABLE">("NEW_TABLE");
  const [tableName, setTableName] = useState(defaultTableName);
  const [targetTableId, setTargetTableId] = useState(targets[0]?.id ?? "");
  const [mapping, setMapping] = useState<Record<number, string>>(() =>
    guessMapping(initialColumns, targets[0]),
  );

  const target = targets.find((entry) => entry.id === targetTableId);

  useEffect(() => {
    if (importState.status === "success" && importState.redirectTo) {
      router.push(importState.redirectTo);
    }
  }, [importState.status, importState.redirectTo, router]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        scanJobId: scanId,
        mode,
        tableName: tableName.trim() || undefined,
        targetTableId: targetTableId || undefined,
        mapping,
        table: {
          title: title.trim() || null,
          columns: columns.map((column) => ({ label: column.label, confidence: column.confidence })),
          rows: rows.map((row) =>
            row.map((cell) => ({
              value: cell.value,
              confidence: cell.confidence,
              uncertain: cell.uncertain,
              note: cell.note,
            })),
          ),
        },
      }),
    [scanId, mode, tableName, targetTableId, mapping, title, columns, rows],
  );

  const uncertainCount = rows.reduce(
    (total, row) => total + row.filter((cell) => cellIsUncertain(cell) && cell.value.trim() !== "").length,
    0,
  );

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((current) =>
      current.map((row, r) =>
        r === rowIndex
          ? row.map((cell, c) => (c === columnIndex ? { ...cell, value, uncertain: false, confidence: null } : cell))
          : row,
      ),
    );
  }

  function updateColumnLabel(columnIndex: number, label: string) {
    setColumns((current) => current.map((column, index) => (index === columnIndex ? { ...column, label } : column)));
  }

  function addRow() {
    setRows((current) => [...current, columns.map(() => emptyCell())]);
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((_row, index) => index !== rowIndex));
  }

  function addColumn() {
    setColumns((current) => [...current, { label: `Column ${current.length + 1}`, confidence: null }]);
    setRows((current) => current.map((row) => [...row, emptyCell()]));
  }

  function removeColumn(columnIndex: number) {
    if (columns.length <= 1) {
      return;
    }
    setColumns((current) => current.filter((_column, index) => index !== columnIndex));
    setRows((current) => current.map((row) => row.filter((_cell, index) => index !== columnIndex)));
  }

  function onCellKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const move = (deltaRow: number, deltaColumn: number) => {
      const nextRow = rowIndex + deltaRow;
      const nextColumn = columnIndex + deltaColumn;
      if (nextRow < 0 || nextRow >= rows.length || nextColumn < 0 || nextColumn >= columns.length) {
        return;
      }
      const element = document.getElementById(`scan-cell-${nextRow}-${nextColumn}`);
      if (element instanceof HTMLInputElement) {
        element.focus();
        element.select();
      }
    };
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1, 0);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1, 0);
    } else if (event.key === "ArrowLeft" && (event.currentTarget.selectionStart ?? 0) === 0) {
      event.preventDefault();
      move(0, -1);
    } else if (
      event.key === "ArrowRight" &&
      (event.currentTarget.selectionStart ?? 0) === event.currentTarget.value.length
    ) {
      event.preventDefault();
      move(0, 1);
    }
  }

  return (
    <div className="space-y-5">
      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warnings.map((warning, index) => (
            <li key={index}>• {warning}</li>
          ))}
        </ul>
      ) : null}

      <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Read by <span className="font-semibold">{provider}</span>. Highlighted cells were read with low confidence —
        check them before importing.{" "}
        {uncertainCount > 0 ? (
          <span className="font-semibold">{uncertainCount} cell(s) need review.</span>
        ) : (
          "No uncertain values flagged."
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-emerald-950">
          Document title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            className="mt-1 block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-sm hover:bg-emerald-50"
          >
            Add row
          </button>
          <button
            type="button"
            onClick={addColumn}
            className="rounded-lg border border-emerald-200 px-3 py-2 text-sm hover:bg-emerald-50"
          >
            Add column
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-emerald-100 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-10 border border-emerald-100 bg-slate-100 px-2 py-1 text-xs text-slate-500">
                #
              </th>
              {columns.map((column, columnIndex) => (
                <th key={columnIndex} className="border border-emerald-100 bg-emerald-50 p-1 align-top">
                  <input
                    value={column.label}
                    onChange={(event) => updateColumnLabel(columnIndex, event.target.value)}
                    maxLength={100}
                    aria-label={`Column ${columnIndex + 1} name`}
                    className="w-full min-w-[9rem] rounded border border-emerald-200 bg-white px-2 py-1 text-sm font-semibold text-emerald-950"
                  />
                  <button
                    type="button"
                    onClick={() => removeColumn(columnIndex)}
                    className="mt-1 text-xs text-rose-600 hover:underline"
                  >
                    remove column
                  </button>
                </th>
              ))}
              <th className="border border-emerald-100 bg-slate-50 px-2 py-1 text-xs text-slate-500">Row</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="sticky left-0 z-10 border border-emerald-100 bg-slate-100 px-2 py-1 text-center text-xs text-slate-500">
                  {rowIndex + 1}
                </td>
                {columns.map((_column, columnIndex) => {
                  const cell = row[columnIndex] ?? emptyCell();
                  const uncertain = cellIsUncertain(cell);
                  const hint = confidenceText(cell);
                  return (
                    <td key={columnIndex} className="border border-emerald-100 p-0">
                      <input
                        id={`scan-cell-${rowIndex}-${columnIndex}`}
                        value={cell.value}
                        onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                        onKeyDown={(event) => onCellKeyDown(event, rowIndex, columnIndex)}
                        title={hint ?? undefined}
                        aria-label={`Row ${rowIndex + 1}, ${columns[columnIndex]?.label ?? `column ${columnIndex + 1}`}${uncertain ? " (uncertain)" : ""}`}
                        className={`w-full min-w-[9rem] border-0 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-500 ${
                          uncertain ? "bg-amber-50 text-amber-900" : "bg-white text-slate-800"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="border border-emerald-100 px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="text-xs text-rose-600 hover:underline"
                    aria-label={`Remove row ${rowIndex + 1}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canImport ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You can review this scan but not import it. Ask an owner or manager for table and record permissions.
        </p>
      ) : null}

      <fieldset className="rounded-xl border border-emerald-100 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-emerald-950">Import destination</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "NEW_TABLE"}
              onChange={() => setMode("NEW_TABLE")}
              className="h-4 w-4"
            />
            Create a new table
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "EXISTING_TABLE"}
              onChange={() => setMode("EXISTING_TABLE")}
              disabled={targets.length === 0}
              className="h-4 w-4"
            />
            Add to an existing table
          </label>
        </div>

        {mode === "NEW_TABLE" ? (
          <label className="mt-4 block text-sm font-medium text-emerald-950">
            New table name
            <input
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              maxLength={100}
              className="mt-1 block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-emerald-950">
              Target table
              <select
                value={targetTableId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setTargetTableId(nextId);
                  setMapping(guessMapping(columns, targets.find((entry) => entry.id === nextId)));
                }}
                className="mt-1 block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
              >
                {targets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-medium text-emerald-950">Match columns to fields</p>
              <div className="mt-2 space-y-2">
                {columns.map((column, columnIndex) => (
                  <div key={columnIndex} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
                    <span className="text-sm text-slate-700">{column.label || `Column ${columnIndex + 1}`}</span>
                    <select
                      value={mapping[columnIndex] ?? ""}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [columnIndex]: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-emerald-200 px-2 py-1 text-sm"
                    >
                      <option value="">— skip —</option>
                      {target?.fields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={saveAction}>
          <input type="hidden" name="payload" value={payload} />
          <ActionSubmitButton pending={savePending}>Save review</ActionSubmitButton>
        </form>
        <form action={importAction}>
          <input type="hidden" name="payload" value={payload} />
          <button
            type="submit"
            disabled={!canImport || importPending}
            aria-busy={importPending}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importPending ? "Importing…" : "Import to table"}
          </button>
        </form>
      </div>

      <ActionMessage state={saveState} />
      <ActionMessage state={importState} />
    </div>
  );
}
