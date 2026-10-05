import { FieldType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  CSV_CONTENT_TYPE,
  isFormulaLikeValue,
  neutralizeCsvFormula,
  safeDownloadFilename,
  sanitizeSpreadsheetValue,
  serializeCsv,
  toSpreadsheetCell,
} from "@/lib/security/csv";
import { FIELD_TYPE_LABELS } from "@/components/business/rules";

describe("csv formula neutralization", () => {
  it("neutralizes leading formula characters", () => {
    expect(neutralizeCsvFormula("=1+1")).toBe("'=1+1");
    expect(neutralizeCsvFormula("  +SUM(A1)")).toBe("'  +SUM(A1)");
    expect(neutralizeCsvFormula("-2")).toBe("'-2");
    expect(neutralizeCsvFormula("@cmd")).toBe("'@cmd");
    expect(neutralizeCsvFormula("\tvalue")).toBe("'\tvalue");
  });

  it("leaves ordinary text untouched", () => {
    expect(neutralizeCsvFormula("Client name")).toBe("Client name");
    expect(neutralizeCsvFormula("2026-01-05")).toBe("2026-01-05");
  });

  it("detects formula-like values recursively", () => {
    expect(isFormulaLikeValue("=1")).toBe(true);
    expect(isFormulaLikeValue(["ok", "=1"])).toBe(true);
    expect(isFormulaLikeValue(["ok", "fine"])).toBe(false);
    expect(isFormulaLikeValue(42)).toBe(false);
    expect(isFormulaLikeValue(null)).toBe(false);
  });
});

describe("serializeCsv", () => {
  it("quotes, escapes and neutralizes headers and cells", () => {
    const csv = serializeCsv(["Name", "=SUM(A1)"], [["Doe, Jane", "=1+1"]]);
    expect(csv).toBe('"Name","\'=SUM(A1)"\r\n"Doe, Jane","\'=1+1"\r\n');
  });
});

describe("toSpreadsheetCell", () => {
  it("preserves primitive and date types", () => {
    const date = new Date("2026-03-01T00:00:00.000Z");
    expect(toSpreadsheetCell(5)).toBe(5);
    expect(toSpreadsheetCell(true)).toBe(true);
    expect(toSpreadsheetCell(date)).toBe(date);
    expect(toSpreadsheetCell(null)).toBeNull();
    expect(toSpreadsheetCell(undefined)).toBeNull();
  });

  it("neutralizes formula-like strings", () => {
    expect(toSpreadsheetCell("=cmd|calc")).toBe("'=cmd|calc");
  });

  it("serializes complex values to neutralized json text", () => {
    expect(toSpreadsheetCell({ a: 1 })).toBe('{"a":1}');
  });
});

describe("sanitizeSpreadsheetValue", () => {
  it("neutralizes strings inside arrays", () => {
    expect(sanitizeSpreadsheetValue(["a", "=1"])).toEqual(["a", "'=1"]);
    expect(sanitizeSpreadsheetValue(7)).toBe(7);
  });
});

describe("safeDownloadFilename", () => {
  it("strips path traversal and unsafe characters", () => {
    expect(safeDownloadFilename("../../etc/passwd")).toBe("passwd");
    expect(safeDownloadFilename("clients:2026?.csv")).toBe("clients_2026_.csv");
    expect(safeDownloadFilename("   ")).toBe("download");
  });
});

describe("export contract", () => {
  it("uses a spreadsheet-friendly content type for csv", () => {
    expect(CSV_CONTENT_TYPE).toContain("text/csv");
  });

  it("labels every field type used by imports", () => {
    const importable: FieldType[] = [
      FieldType.SHORT_TEXT,
      FieldType.LONG_TEXT,
      FieldType.NUMBER,
      FieldType.CURRENCY,
      FieldType.CHECKBOX,
      FieldType.DATE,
      FieldType.DATETIME,
      FieldType.EMAIL,
      FieldType.PHONE,
      FieldType.URL,
    ];
    for (const type of importable) {
      expect(FIELD_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});