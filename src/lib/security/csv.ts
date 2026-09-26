export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

export function neutralizeCsvFormula(value: string): string {
  if (/^[\u0000-\u0020]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function sanitizeCsvHeader(value: unknown): string {
  const text = stringifyCsvValue(value);
  const neutralized = neutralizeCsvFormula(text);
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function sanitizeCsvCell(value: unknown): string {
  return sanitizeCsvHeader(value);
}

export function serializeCsv(headers: readonly unknown[], rows: readonly (readonly unknown[])[]): string {
  const lines = [headers.map(sanitizeCsvHeader).join(",")];
  for (const row of rows) {
    lines.push(row.map(sanitizeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getJsonRecordValue(value: unknown, key: string): unknown {
  return isRecordValue(value) ? value[key] : undefined;
}

export function safeDownloadFilename(
  value: string | null | undefined,
  fallback = "download",
): string {
  const source = typeof value === "string" ? value.trim() : "";
  const lastSegment = source.split(/[\\/]/u).pop() ?? "";
  const sanitized = lastSegment
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._ -]/gu, "_")
    .replace(/[. ]+$/u, "")
    .slice(0, 180);
  return sanitized || fallback;
}

export function safeDownloadFilenameWithExtension(
  value: string | null | undefined,
  extension: string,
  fallback = "download",
): string {
  const normalizedExtension = extension.trim().toLowerCase();
  if (!/^[a-z0-9]{1,10}$/u.test(normalizedExtension)) {
    return safeDownloadFilename(fallback, "download");
  }
  const source = safeDownloadFilename(value, "");
  const stem = source.replace(/\.[A-Za-z0-9]{1,10}$/u, "");
  const safeFallback = safeDownloadFilename(fallback, "download").replace(
    /\.[A-Za-z0-9]{1,10}$/u,
    "",
  );
  return safeDownloadFilename(
    `${stem || safeFallback || "download"}.${normalizedExtension}`,
    `${safeFallback || "download"}.${normalizedExtension}`,
  );
}

export function contentDispositionAttachment(filename: string): string {
  const safeFilename = safeDownloadFilename(filename);
  const encoded = encodeURIComponent(safeFilename).replace(
    /['()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${safeFilename.replace(/"/gu, "")}"; filename*=UTF-8''${encoded}`;
}

export const escapeCsvCell = sanitizeCsvCell;
export const escapeCsvValue = sanitizeCsvCell;
export const escapeCsvHeader = sanitizeCsvHeader;
