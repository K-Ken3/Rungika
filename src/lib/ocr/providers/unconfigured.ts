import { OcrNotConfiguredError, type ExtractedTable, type OcrProvider } from "../types";

export const unconfiguredProvider: OcrProvider = {
  name: "unconfigured",
  isConfigured() {
    return false;
  },
  async extractTable(): Promise<ExtractedTable> {
    throw new OcrNotConfiguredError(
      "Scan to Table is not configured on this server yet. Add an OCR provider key (see the setup notes) to enable it.",
    );
  },
};
