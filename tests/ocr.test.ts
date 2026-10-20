import { describe, expect, it } from "vitest";

import { parseJsonObject } from "@/lib/ocr/prompt";
import {
  MAX_EXTRACTED_COLUMNS,
  MAX_EXTRACTED_ROWS,
  normalizeExtractedTable,
  UNCERTAIN_CONFIDENCE_THRESHOLD,
} from "@/lib/ocr/normalize";

describe("parseJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(parseJsonObject('{"title":"Stock","columns":[]}')).toEqual({ title: "Stock", columns: [] });
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"title":"Sales"}\n```';
    expect(parseJsonObject(raw)).toEqual({ title: "Sales" });
  });

  it("extracts the object from surrounding prose", () => {
    const raw = 'Here is the table:\n{"title":"Milk","rows":[]}\nHope that helps!';
    expect(parseJsonObject(raw)).toEqual({ title: "Milk", rows: [] });
  });

  it("throws when no object is present", () => {
    expect(() => parseJsonObject("not json at all")).toThrow(/readable table/i);
  });
});

describe("normalizeExtractedTable", () => {
  it("normalizes array rows and cell objects", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      title: "Daily sales",
      columns: [{ label: "Item", confidence: 0.9 }, { label: "Amount" }],
      rows: [["Milk", { value: "1200", confidence: 0.55 }]],
    });

    expect(table.provider).toBe("test");
    expect(table.title).toBe("Daily sales");
    expect(table.columns.map((column) => column.label)).toEqual(["Item", "Amount"]);
    expect(table.columns[0].confidence).toBe(0.9);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells[0]).toMatchObject({ value: "Milk", confidence: null });
    expect(table.rows[0].cells[1].value).toBe("1200");
    expect(table.rows[0].cells[1].confidence).toBe(0.55);
    expect(table.rows[0].cells[1].uncertain).toBe(true);
  });

  it("pads short rows so every row matches the column width", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      columns: ["A", "B", "C"],
      rows: [["only-one"]],
    });
    expect(table.rows[0].cells).toHaveLength(3);
    expect(table.rows[0].cells[1].value).toBe("");
    expect(table.rows[0].cells[2].value).toBe("");
  });

  it("adds placeholder columns when a row is wider than the header", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      columns: ["A"],
      rows: [["1", "2", "3"]],
    });
    expect(table.columns).toHaveLength(3);
    expect(table.columns[2].label).toBe("Column 3");
  });

  it("converts percentage-style confidences to a 0-1 range", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      columns: [{ label: "A" }],
      rows: [[{ value: "x", confidence: 85 }]],
    });
    expect(table.rows[0].cells[0].confidence).toBeCloseTo(0.85);
  });

  it("flags illegible text as uncertain", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      columns: ["Item"],
      rows: [["???"], ["ok value"], ["(illegible)"]],
    });
    expect(table.rows[0].cells[0].uncertain).toBe(true);
    expect(table.rows[1].cells[0].uncertain).toBe(false);
    expect(table.rows[2].cells[0].uncertain).toBe(true);
  });

  it("uses the uncertainty threshold for low-confidence cells", () => {
    const table = normalizeExtractedTable({
      provider: "test",
      columns: ["A"],
      rows: [[{ value: "x", confidence: UNCERTAIN_CONFIDENCE_THRESHOLD - 0.01 }]],
    });
    expect(table.rows[0].cells[0].uncertain).toBe(true);
  });

  it("caps the number of columns and rows", () => {
    const wideColumns = Array.from({ length: MAX_EXTRACTED_COLUMNS + 5 }, (_u, i) => `C${i}`);
    const tallRows = Array.from({ length: MAX_EXTRACTED_ROWS + 25 }, () => ["x"]);
    const table = normalizeExtractedTable({
      provider: "test",
      columns: wideColumns,
      rows: tallRows,
    });
    expect(table.columns).toHaveLength(MAX_EXTRACTED_COLUMNS);
    expect(table.rows).toHaveLength(MAX_EXTRACTED_ROWS);
    expect(table.warnings.some((warning) => warning.includes(String(MAX_EXTRACTED_ROWS)))).toBe(true);
  });

  it("throws when nothing tabular could be read", () => {
    expect(() => normalizeExtractedTable({ provider: "test", columns: [], rows: [] })).toThrow(
      /No table could be read/i,
    );
  });
});
