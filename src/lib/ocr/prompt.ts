export const TABLE_EXTRACTION_INSTRUCTION = [
  "You extract business tables from photographs and scans of handwritten or printed records.",
  "Return ONLY a JSON object, no prose and no markdown fences.",
  "The JSON shape is:",
  '{"title": string|null, "columns": [{"label": string, "confidence": number}], "rows": [{"cells": [{"value": string, "confidence": number, "uncertain": boolean, "note": string|null}]}], "warnings": [string], "rawText": string|null}',
  "Rules:",
  "- Read the ACTUAL column headings written on the document. Do not rename them to a fixed set.",
  "- Every row must have exactly one cell object per column, in the same order as the columns array.",
  "- value must be a string exactly as written; convert numbers and dates to text but do not change digits or currency symbols.",
  "- confidence is a number from 0 to 1 for how sure you are of that cell. Use your real uncertainty.",
  "- Set uncertain=true for any value that is smudged, ambiguous, partially cut off, or that you are guessing.",
  "- Never invent values. If a cell is empty or unreadable, leave value as an empty string (or the partial text you can see) and set uncertain=true.",
  "- Do not perform arithmetic or add totals that are not written on the page.",
  "- If the document is not a table, return the closest tabular reading you can and add a warning describing the problem.",
  "- If a currency or unit is written, keep it in the cell text.",
].join("\n");

export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidates = [withoutFences];
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(withoutFences.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }

  throw new Error("The scanning service did not return a readable table.");
}
