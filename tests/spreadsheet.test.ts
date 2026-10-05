import { describe, expect, it } from "vitest";
import {
  assertSpreadsheetSize,
  buildImportPlan,
  coerceParsedWorkbook,
  inferColumnType,
  parseCsv,
  SpreadsheetImportError,
  toCsv,
} from "@/lib/spreadsheet/core";

describe("upload limits", () => {
  it("rejects files above the server action body limit", () => {
    expect(() => assertSpreadsheetSize({ size: 1024 })).not.toThrow();
    expect(() => assertSpreadsheetSize({ size: 3.5 * 1024 * 1024 })).not.toThrow();
    expect(() => assertSpreadsheetSize({ size: 3.5 * 1024 * 1024 + 1 })).toThrow(/3.5 MB/);
  });

  it("rejects empty files", () => {
    expect(() => assertSpreadsheetSize({ size: 0 })).toThrow(/empty/);
  });
});

describe("spreadsheet type inference", () => {
  it("detects numbers, currency, booleans, dates, emails, phones and urls", () => {
    expect(inferColumnType(["1", "2", "3"])).toBe("NUMBER");
    expect(inferColumnType(["1.5", "$2,000.00"])).toBe("CURRENCY");
    expect(inferColumnType(["true", "false", "yes"])).toBe("CHECKBOX");
    expect(inferColumnType(["2026-01-05", "2026-12-31"])).toBe("DATE");
    expect(inferColumnType(["2026-01-05 09:30:00"])).toBe("DATETIME");
    expect(inferColumnType(["a@b.com", "c@d.org"])).toBe("EMAIL");
    expect(inferColumnType(["+250 788 123 456"])).toBe("PHONE");
    expect(inferColumnType(["https://rungika.site"])).toBe("URL");
    expect(inferColumnType(["Alice", "Bob"])).toBe("SHORT_TEXT");
    expect(inferColumnType([])).toBe("SHORT_TEXT");
  });

  it("falls back to long text for very long values", () => {
    expect(inferColumnType(["x".repeat(400)])).toBe("LONG_TEXT");
  });
});

describe("csv parsing", () => {
  it("parses headers and rows", () => {
    const parsed = parseCsv("Name,Age\nAlice,30\nBob,41\n");
    expect(parsed.headers).toEqual(["Name", "Age"]);
    expect(parsed.rows).toEqual([
      ["Alice", "30"],
      ["Bob", "41"],
    ]);
  });

  it("handles quoted values, embedded commas and escaped quotes", () => {
    const parsed = parseCsv('Name,Note\n"Doe, Jane","She said ""hi"""\n');
    expect(parsed.rows[0]).toEqual(["Doe, Jane", 'She said "hi"']);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("\uFEFFName,Age\nAlice,30\n").headers).toEqual(["Name", "Age"]);
  });

  it("deduplicates repeated headers", () => {
    expect(parseCsv("Name,Name,Name\nA,B,C\n").headers).toEqual([
      "Name",
      "Name (2)",
      "Name (3)",
    ]);
  });

  it("names blank headers positionally", () => {
    expect(parseCsv("Name,,Age\nAlice,x,30\n").headers).toEqual([
      "Name",
      "Column 2",
      "Age",
    ]);
  });

  it("drops fully blank rows", () => {
    expect(parseCsv("Name,Age\nAlice,30\n,\nBob,41\n").rows).toHaveLength(2);
  });
});

describe("workbook coercion", () => {
  it("reads excel rich text, hyperlinks and formula results", () => {
    const parsed = coerceParsedWorkbook({
      sheetNames: ["Sheet1"],
      sheetName: "Sheet1",
      matrix: [
        [{ richText: [{ text: "Name" }] }, { text: "Site" }],
        [{ text: "Alice" }, { hyperlink: "https://rungika.site" }],
        [{ text: "Bob" }, { result: 7 }],
      ],
    });
    expect(parsed.headers).toEqual(["Name", "Site"]);
    expect(parsed.rows).toEqual([
      ["Alice", "https://rungika.site"],
      ["Bob", 7],
    ]);
  });

  it("rejects workbooks exceeding the row limit", () => {
    const matrix = [["Name"], ...Array.from({ length: 5001 }, () => ["x"])];
    expect(() =>
      coerceParsedWorkbook({ sheetNames: ["S"], sheetName: "S", matrix }),
    ).toThrow(SpreadsheetImportError);
  });

  it("rejects workbooks exceeding the column limit", () => {
    const header = Array.from({ length: 61 }, (_, index) => `C${index}`);
    expect(() =>
      coerceParsedWorkbook({
        sheetNames: ["S"],
        sheetName: "S",
        matrix: [header, header.map(() => "x")],
      }),
    ).toThrow(/60 columns/);
  });
});

describe("import plan", () => {
  it("builds typed columns and uses the sheet name", () => {
    const parsed = parseCsv("Name,Age\nAlice,30\n");
    const plan = buildImportPlan(parsed, "");
    expect(plan.tableName).toBe("Sheet1");
    expect(plan.columns.map((column) => column.type)).toEqual(["SHORT_TEXT", "NUMBER"]);
    expect(plan.rowCount).toBe(1);
  });

  it("prefers an explicit table name", () => {
    const plan = buildImportPlan(parseCsv("Name\nAlice\n"), "Client list");
    expect(plan.tableName).toBe("Client list");
  });
});

describe("csv export", () => {
  it("quotes values containing commas or quotes", () => {
    const csv = toCsv(
      [{ label: "Name", type: "SHORT_TEXT" }],
      [["Doe, Jane"]],
    );
    expect(csv).toBe('Name\r\n"Doe, Jane"');
  });
});