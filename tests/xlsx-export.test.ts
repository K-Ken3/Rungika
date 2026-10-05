import { describe, expect, it } from "vitest";
import { buildXlsxBuffer } from "@/lib/spreadsheet/xlsx";

async function readSheet(buffer: Buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const bytes = new Uint8Array(buffer);
  await workbook.xlsx.load(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return workbook.worksheets[0];
}

describe("xlsx export", () => {
  it("writes headers, primitive values and object values", { timeout: 60_000 }, async () => {
    const buffer = await buildXlsxBuffer({
      sheetName: "Clients",
      headers: ["Name", "Amount", "Paid"],
      rows: [
        ["Doe, Jane", 1250.5, true],
        ["Acme Ltd", 4300, false],
      ],
    });

    expect(buffer.byteLength).toBeGreaterThan(0);

    const sheet = await readSheet(buffer);
    expect(sheet.name).toBe("Clients");
    expect(sheet.getRow(1).values).toEqual([undefined, "Name", "Amount", "Paid"]);
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      "Doe, Jane",
      1250.5,
      true,
    ]);
  });

  it("stores formula-like values as inert text", { timeout: 60_000 }, async () => {
    const ExcelJS = (await import("exceljs")).default;
    const buffer = await buildXlsxBuffer({
      sheetName: "Export",
      headers: ["Notes", "=SUM(A1:A9)"],
      rows: [['=cmd|\' /c calc\'!A0', "@SUM(1)"]],
    });

    const sheet = await readSheet(buffer);
    const row = sheet.getRow(2);
    expect(row.getCell(1).value).toBe("'=cmd|' /c calc'!A0");
    expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);
    expect(row.getCell(2).value).toBe("'@SUM(1)");
    expect(row.getCell(2).type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getRow(1).getCell(2).value).toBe("'=SUM(A1:A9)");
  });

  it("freezes the header row and bolds it", { timeout: 60_000 }, async () => {
    const buffer = await buildXlsxBuffer({
      sheetName: "Export",
      headers: ["A"],
      rows: [["1"]],
    });
    const sheet = await readSheet(buffer);
    expect(sheet.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getRow(1).font).toEqual({ bold: true });
    expect(sheet.getColumn(1).width).toBe(14);
  });

  it("truncates sheet names to Excel limits", { timeout: 60_000 }, async () => {
    const buffer = await buildXlsxBuffer({
      sheetName: "A".repeat(60),
      headers: ["A"],
      rows: [],
    });
    const sheet = await readSheet(buffer);
    expect(sheet.name).toHaveLength(31);
  });
});
