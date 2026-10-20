import "server-only";

import { geminiProvider } from "./providers/gemini";
import { openAiProvider } from "./providers/openai";
import { unconfiguredProvider } from "./providers/unconfigured";
import type { OcrProvider } from "./types";

const PROVIDERS: Record<string, OcrProvider> = {
  gemini: geminiProvider,
  openai: openAiProvider,
  none: unconfiguredProvider,
};

export function getOcrProvider(): OcrProvider {
  const requested = process.env.OCR_PROVIDER?.trim().toLowerCase();
  if (requested && requested in PROVIDERS) {
    const provider = PROVIDERS[requested];
    return provider.isConfigured() ? provider : unconfiguredProvider;
  }
  if (geminiProvider.isConfigured()) {
    return geminiProvider;
  }
  if (openAiProvider.isConfigured()) {
    return openAiProvider;
  }
  return unconfiguredProvider;
}

export function isOcrConfigured(): boolean {
  return getOcrProvider().isConfigured();
}

export { OcrNotConfiguredError, OcrProviderError } from "./types";
export type { ExtractedTable, OcrCell, OcrColumn, OcrRow, OcrInput, OcrProvider } from "./types";
export { UNCERTAIN_CONFIDENCE_THRESHOLD } from "./normalize";
