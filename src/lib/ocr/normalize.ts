import type { ExtractedTable, OcrCell, OcrColumn, OcrRow } from "./types";

export const UNCERTAIN_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_EXTRACTED_COLUMNS = 60;
export const MAX_EXTRACTED_ROWS = 2000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function toConfidence(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0) return 0;
    if (value > 1) return value > 100 ? 1 : value / 100;
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return toConfidence(parsed);
    }
  }
  return null;
}

function toCell(raw: unknown): OcrCell {
  const record = asRecord(raw);
  if (record) {
    const value = toText(record.value ?? record.text ?? record.content ?? "");
    const confidence = toConfidence(record.confidence ?? record.score ?? null);
    const note = record.note === undefined ? null : toText(record.note);
    const explicitUncertain = record.uncertain === true;
    return {
      value,
      confidence,
      uncertain:
        explicitUncertain ||
        isUncertainText(value) ||
        (confidence !== null && confidence < UNCERTAIN_CONFIDENCE_THRESHOLD),
      note: note && note.length > 0 ? note : null,
    };
  }
  const value = toText(raw);
  return {
    value,
    confidence: null,
    uncertain: isUncertainText(value),
    note: null,
  };
}

function isUncertainText(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  return /(\?\?\?|\btbd\b|\billegible\b|\bunclear\b|\[\?+\])/i.test(value);
}

function toColumn(raw: unknown, index: number): OcrColumn {
  const record = asRecord(raw);
  if (record) {
    return {
      label: toText(record.label ?? record.name ?? record.title ?? "") || `Column ${index + 1}`,
      confidence: toConfidence(record.confidence ?? null),
    };
  }
  return {
    label: toText(raw) || `Column ${index + 1}`,
    confidence: null,
  };
}

export interface RawExtractedTable {
  provider: string;
  title?: unknown;
  columns?: unknown;
  headers?: unknown;
  rows?: unknown;
  warnings?: unknown;
  rawText?: unknown;
}

export function normalizeExtractedTable(raw: RawExtractedTable): ExtractedTable {
  const warnings: string[] = Array.isArray(raw.warnings)
    ? raw.warnings.map((entry) => toText(entry)).filter((entry) => entry.length > 0)
    : [];

  const rawColumns = Array.isArray(raw.columns)
    ? raw.columns
    : Array.isArray(raw.headers)
      ? raw.headers
      : [];

  const columns: OcrColumn[] = rawColumns
    .slice(0, MAX_EXTRACTED_COLUMNS)
    .map((column, index) => toColumn(column, index));

  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: OcrRow[] = [];

  for (const rawRow of rawRows) {
    if (rows.length >= MAX_EXTRACTED_ROWS) {
      warnings.push(`Only the first ${MAX_EXTRACTED_ROWS} rows were kept. Split large documents into pages.`);
      break;
    }
    if (Array.isArray(rawRow)) {
      rows.push({ cells: rawRow.slice(0, MAX_EXTRACTED_COLUMNS).map((cell) => toCell(cell)) });
      continue;
    }
    const record = asRecord(rawRow);
    const cells = record && Array.isArray(record.cells) ? record.cells : null;
    if (cells) {
      rows.push({ cells: cells.slice(0, MAX_EXTRACTED_COLUMNS).map((cell) => toCell(cell)) });
      continue;
    }
    if (record) {
      rows.push({ cells: Object.values(record).slice(0, MAX_EXTRACTED_COLUMNS).map((cell) => toCell(cell)) });
    }
  }

  const width = Math.max(columns.length, ...rows.map((row) => row.cells.length), 0);
  const normalizedColumns: OcrColumn[] =
    columns.length >= width
      ? columns.slice(0, width)
      : [
          ...columns,
          ...Array.from({ length: width - columns.length }, (_unused, index) => ({
            label: `Column ${columns.length + index + 1}`,
            confidence: null,
          })),
        ];

  const normalizedRows: OcrRow[] = rows.map((row) => ({
    cells: Array.from({ length: width }, (_unused, index) => row.cells[index] ?? {
      value: "",
      confidence: null,
      uncertain: false,
      note: null,
    }),
  }));

  if (width === 0) {
    throw new Error("No table could be read from this document.");
  }
  if (normalizedRows.length === 0) {
    warnings.push("No data rows were detected. Check the image quality and try again.");
  }

  return {
    provider: raw.provider,
    title: raw.title === undefined || raw.title === null ? null : toText(raw.title) || null,
    columns: normalizedColumns,
    rows: normalizedRows,
    warnings,
    rawText: raw.rawText === undefined ? null : toText(raw.rawText) || null,
  };
}
