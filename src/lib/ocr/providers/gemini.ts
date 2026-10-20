import "server-only";

import { normalizeExtractedTable } from "../normalize";
import { parseJsonObject, TABLE_EXTRACTION_INSTRUCTION } from "../prompt";
import { OcrProviderError, type ExtractedTable, type OcrInput, type OcrProvider } from "../types";

const DEFAULT_MODEL = "gemini-2.0-flash";
const DEFAULT_TIMEOUT_MS = 45_000;

function readApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  );
}

function readTimeout(): number {
  const parsed = Number(process.env.OCR_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 5_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

export const geminiProvider: OcrProvider = {
  name: "gemini",
  isConfigured() {
    return readApiKey().length > 0;
  },
  async extractTable(input: OcrInput): Promise<ExtractedTable> {
    const apiKey = readApiKey();
    if (!apiKey) {
      throw new OcrProviderError("Gemini is not configured.");
    }
    const model = process.env.OCR_GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: input.mime, data: Buffer.from(input.bytes).toString("base64") } },
                { text: TABLE_EXTRACTION_INSTRUCTION },
                ...(input.hint ? [{ text: `Extra context from the user: ${input.hint}` }] : []),
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new OcrProviderError("The scan timed out. Try a smaller or clearer image.");
      }
      throw new OcrProviderError("Could not reach the scanning service. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await safeErrorText(response);
      throw new OcrProviderError(
        response.status === 429
          ? "The scanning service is busy right now. Wait a moment and try again."
          : `The scanning service rejected the request (${response.status}). ${detail}`.trim(),
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> }; finishReason?: string }>;
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();

    if (!text) {
      throw new OcrProviderError("The scanning service returned an empty result.");
    }

    const parsed = parseJsonObject(text);
    return normalizeExtractedTable({ provider: "gemini", ...parsed });
  },
};

async function safeErrorText(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 300);
  } catch {
    return "";
  }
}
