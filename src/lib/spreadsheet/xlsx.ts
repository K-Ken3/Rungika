import { sanitizeSpreadsheetValue, toSpreadsheetCell } from "@/lib/security/csv";

type SpreadsheetRowValue = string | number | boolean | Date | null;

export interface XlsxSheetData {
  sheetName: string;
  headers: readonly string[];
  rows: readonly (readonly unknown[])[];
}

export async function buildXlsxBuffer(data: XlsxSheetData): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rungika";
  workbook.created = new Date(0);

  const sheet = workbook.addWorksheet(data.sheetName.slice(0, 31) || "Export");
  sheet.addRow(data.headers.map((header) => sanitizeSpreadsheetValue(header) as string));

  for (const row of data.rows) {
    const cells: SpreadsheetRowValue[] = row.map((value) => toSpreadsheetCell(value));
    sheet.addRow(cells);
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: false };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  data.headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.min(42, Math.max(header.length + 4, 14));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
