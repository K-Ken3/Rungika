import "server-only";

import { normalizeExtractedTable } from "../normalize";
import { parseJsonObject, TABLE_EXTRACTION_INSTRUCTION } from "../prompt";
import { OcrProviderError, type ExtractedTable, type OcrInput, type OcrProvider } from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 45_000;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function readApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

function readTimeout(): number {
  const parsed = Number(process.env.OCR_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 5_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

export const openAiProvider: OcrProvider = {
  name: "openai",
  isConfigured() {
    return readApiKey().length > 0;
  },
  async extractTable(input: OcrInput): Promise<ExtractedTable> {
    const apiKey = readApiKey();
    if (!apiKey) {
      throw new OcrProviderError("OpenAI is not configured.");
    }
    if (!IMAGE_MIME_TYPES.has(input.mime)) {
      throw new OcrProviderError(
        "The OpenAI scanner handles images only. Use a photo, or choose Gemini for PDFs.",
      );
    }

    const model = process.env.OCR_OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const dataUrl = `data:${input.mime};base64,${Buffer.from(input.bytes).toString("base64")}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TABLE_EXTRACTION_INSTRUCTION },
            {
              role: "user",
              content: [
                { type: "text", text: input.hint ? `Extra context: ${input.hint}` : "Extract the table." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
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
      throw new OcrProviderError(
        response.status === 429
          ? "The scanning service is busy right now. Wait a moment and try again."
          : `The scanning service rejected the request (${response.status}).`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) {
      throw new OcrProviderError("The scanning service returned an empty result.");
    }

    const parsed = parseJsonObject(text);
    return normalizeExtractedTable({ provider: "openai", ...parsed });
  },
};
