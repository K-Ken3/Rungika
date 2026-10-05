export type SpreadsheetCell = string | number | boolean | null;

export interface ParsedSpreadsheet {
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  rows: SpreadsheetCell[][];
}

export interface ImportedColumn {
  label: string;
  type: string;
  values: SpreadsheetCell[];
}

export interface SpreadsheetImportPlan {
  sheetName: string;
  sheetNames: string[];
  tableName: string;
  columns: ImportedColumn[];
  rowCount: number;
}

const MAX_IMPORT_BYTES = Math.floor(3.5 * 1024 * 1024);
const MAX_COLUMNS = 60;
const MAX_ROWS = 5000;
const MAX_HEADER_LENGTH = 100;
const MAX_SHEET_NAME_LENGTH = 31;

export class SpreadsheetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetImportError";
  }
}

function assertWithinLimit(value: number, max: number, message: string) {
  if (value > max) {
    throw new SpreadsheetImportError(message);
  }
}

function normalizeCell(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    if ("text" in value) {
      const text = (value as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
    if ("result" in value) {
      const result = (value as { result?: unknown }).result;
      if (typeof result === "string" || typeof result === "number") {
        return result;
      }
      if (result === undefined || result === null) {
        return null;
      }
      return normalizeCell(result);
    }
    if ("richText" in value) {
      const richText = (value as { richText?: Array<{ text?: unknown }> }).richText;
      if (Array.isArray(richText)) {
        return richText.map((entry) => (typeof entry.text === "string" ? entry.text : "")).join("");
      }
    }
    if ("hyperlink" in value) {
      const hyperlink = (value as { hyperlink?: unknown }).hyperlink;
      if (typeof hyperlink === "string") {
        return hyperlink;
      }
    }
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((value) => {
    const base = value.slice(0, MAX_HEADER_LENGTH);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) {
      return base;
    }
    return `${base} (${count + 1})`.slice(0, MAX_HEADER_LENGTH);
  });
}

function isBlankRow(row: SpreadsheetCell[]): boolean {
  return row.every((cell) => cell === null || cell === "");
}

export function parseCsv(text: string): ParsedSpreadsheet {
  const rows: string[][] = [];
  let current: string[] = [];
  let value = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      current.push(value);
      value = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    if (char === "\n") {
      current.push(value);
      rows.push(current);
      current = [];
      value = "";
      continue;
    }
    value += char;
  }
  if (value.length > 0 || current.length > 0) {
    current.push(value);
    rows.push(current);
  }

  const cleaned = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (cleaned.length === 0) {
    return { sheetName: "Sheet1", sheetNames: ["Sheet1"], headers: [], rows: [] };
  }

  const firstRow = cleaned.shift() ?? [];
  const headers = uniqueHeaders(
    firstRow.map((cell, index) => cell.trim() || `Column ${index + 1}`),
  );

  return {
    sheetName: "Sheet1",
    sheetNames: ["Sheet1"],
    headers,
    rows: cleaned.map((row) =>
      headers.map((_, index) => {
        const cell = row[index];
        return cell !== undefined && cell.trim() !== "" ? cell.trim() : null;
      }),
    ),
  };
}

function trimSparseRows(matrix: unknown[][]): unknown[][] {
  const trimmed = [...matrix];
  while (trimmed.length > 0) {
    const row = trimmed[0];
    const empty =
      row === undefined ||
      row === null ||
      (Array.isArray(row) && row.every((cell) => normalizeCell(cell) === null));
    if (!empty) {
      break;
    }
    trimmed.shift();
  }
  while (trimmed.length > 0) {
    const row = trimmed[trimmed.length - 1];
    const empty =
      row === undefined ||
      row === null ||
      (Array.isArray(row) && row.every((cell) => normalizeCell(cell) === null));
    if (!empty) {
      break;
    }
    trimmed.pop();
  }
  return trimmed;
}

function trimSparseColumns(matrix: unknown[][]): unknown[][] {
  const width = matrix.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  const columnHasValue = Array.from({ length: width }, (_unused, column) =>
    matrix.some((row) => {
      const cells = Array.isArray(row) ? row : [];
      return normalizeCell(cells[column]) !== null;
    }),
  );

  const start = columnHasValue.indexOf(true);
  if (start === -1) {
    return matrix.map(() => []);
  }
  const end = columnHasValue.lastIndexOf(true);

  return matrix.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    return Array.from({ length: end - start + 1 }, (_, offset) => cells[start + offset] ?? null);
  });
}

export function coerceParsedWorkbook(input: {
  sheetNames: string[];
  sheetName: string;
  matrix: unknown[][];
}): ParsedSpreadsheet {
  assertWithinLimit(input.sheetNames.length, 50, "This workbook has too many sheets.");
  const matrix = trimSparseColumns(trimSparseRows(input.matrix));
  if (matrix.length === 0) {
    return {
      sheetName: input.sheetName.slice(0, MAX_SHEET_NAME_LENGTH),
      sheetNames: input.sheetNames.map((name) => name.slice(0, MAX_SHEET_NAME_LENGTH)),
      headers: [],
      rows: [],
    };
  }

  const headerRow = matrix[0] ?? [];
  const headers = uniqueHeaders(
    headerRow.map((cell) => {
      const text = normalizeCell(cell);
      return text === null ? "" : String(text).slice(0, MAX_HEADER_LENGTH);
    }).map((text, position) => text || `Column ${position + 1}`),
  );
  assertWithinLimit(headers.length, MAX_COLUMNS, `Spreadsheets are limited to ${MAX_COLUMNS} columns.`);

  const rows = matrix
    .slice(1)
    .map((row) => headers.map((_, index) => normalizeCell(row[index])))
    .filter((row) => !isBlankRow(row));

  assertWithinLimit(rows.length, MAX_ROWS, `Spreadsheets are limited to ${MAX_ROWS} rows.`);

  return {
    sheetName: input.sheetName.slice(0, MAX_SHEET_NAME_LENGTH),
    sheetNames: input.sheetNames.map((name) => name.slice(0, MAX_SHEET_NAME_LENGTH)),
    headers,
    rows,
  };
}

export function assertSpreadsheetSize(file: { size: number }) {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new SpreadsheetImportError("The file must be 3.5 MB or smaller.");
  }
  if (file.size === 0) {
    throw new SpreadsheetImportError("The file is empty.");
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/;
const CURRENCY_SYMBOLS = /[$€£₦₭₹RWF]/gi;

export function inferColumnType(values: SpreadsheetCell[]): string {
  const present = values.filter((value) => value !== null && value !== "");
  if (present.length === 0) {
    return "SHORT_TEXT";
  }

  const allBoolean = present.every(
    (value) => typeof value === "boolean" || /^(true|false|yes|no|y|n)$/i.test(String(value)),
  );
  if (allBoolean) {
    return "CHECKBOX";
  }

  const allNumber = present.every((value) => {
    if (typeof value === "number") {
      return true;
    }
    const cleaned = String(value).replace(CURRENCY_SYMBOLS, "").replace(/,/g, "").trim();
    return cleaned.length > 0 && Number.isFinite(Number(cleaned));
  });
  if (allNumber) {
    const looksMonetary = present.some((value) => CURRENCY_SYMBOLS.test(String(value)));
    return looksMonetary ? "CURRENCY" : "NUMBER";
  }

const allDate = present.every(
      (value) => typeof value === "string" && ISO_DATE.test(value.trim()),
    );
  if (allDate) {
    const hasTime = present.some(
      (value) => typeof value === "string" && /\d{2}:\d{2}/.test(value),
    );
    return hasTime ? "DATETIME" : "DATE";
  }

  const allEmail = present.every(
    (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  );
  if (allEmail) {
    return "EMAIL";
  }

  const allPhone = present.every((value) => {
    if (typeof value === "string") {
      const cleaned = value.trim();
      return /^\+?[\d\s()-]{7,20}$/.test(cleaned) && (cleaned.match(/\d/g) ?? []).length >= 7;
    }
    return false;
  });
  if (allPhone) {
    return "PHONE";
  }

  const allUrl = present.every(
    (value) => typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim()),
  );
  if (allUrl) {
    return "URL";
  }

  let longest = 0;
  for (const value of present) {
    longest = Math.max(longest, String(value).length);
  }
  return longest > 320 ? "LONG_TEXT" : "SHORT_TEXT";
}

export function buildImportPlan(
  parsed: ParsedSpreadsheet,
  preferredTableName: string,
): SpreadsheetImportPlan {
  if (parsed.headers.length === 0) {
    throw new SpreadsheetImportError("The sheet has no columns.");
  }
  const columns = parsed.headers.map((label, index) => {
    const values = parsed.rows.map((row) => row[index] ?? null);
    return { label, values, type: inferColumnType(values) };
  });

  const preferred = preferredTableName.trim();
  const sheetName = parsed.sheetName.trim();
  const tableName =
    preferred.length >= 2 && preferred.length <= 100
      ? preferred
      : sheetName.length >= 2 && sheetName.length <= 100
        ? sheetName
        : "Imported table";

  return {
    sheetName: parsed.sheetName,
    sheetNames: parsed.sheetNames,
    tableName,
    columns,
    rowCount: parsed.rows.length,
  };
}

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface ExportColumn {
  label: string;
  type: string;
}

export function toCsv(columns: ExportColumn[], rows: string[][]): string {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const body = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(","));
  return [header, ...body].join("\r\n");
}