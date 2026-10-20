export type OcrCell = {
  value: string;
  confidence: number | null;
  uncertain: boolean;
  note?: string | null;
};

export type OcrColumn = {
  label: string;
  confidence: number | null;
};

export type OcrRow = {
  cells: OcrCell[];
};

export type ExtractedTable = {
  provider: string;
  title: string | null;
  columns: OcrColumn[];
  rows: OcrRow[];
  warnings: string[];
  rawText: string | null;
};

export type OcrInput = {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  hint?: string;
};

export interface OcrProvider {
  readonly name: string;
  isConfigured(): boolean;
  extractTable(input: OcrInput): Promise<ExtractedTable>;
}

export class OcrNotConfiguredError extends Error {
  constructor(message = "Scanning is not configured yet.") {
    super(message);
    this.name = "OcrNotConfiguredError";
  }
}

export class OcrProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrProviderError";
  }
}
