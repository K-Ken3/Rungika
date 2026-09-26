import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_CRON_SECRET_LENGTH = 512;

function secretHash(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function safeSecretMatches(provided: string | null | undefined, expected: string): boolean {
  const providedValue =
    typeof provided === "string" && provided.length <= MAX_CRON_SECRET_LENGTH ? provided : "";
  const expectedValue =
    typeof expected === "string" && expected.length <= MAX_CRON_SECRET_LENGTH ? expected : "";
  const valid =
    typeof provided === "string" &&
    typeof expected === "string" &&
    provided.length > 0 &&
    expected.length > 0 &&
    provided.length <= MAX_CRON_SECRET_LENGTH &&
    expected.length <= MAX_CRON_SECRET_LENGTH;
  const matches = timingSafeEqual(secretHash(providedValue), secretHash(expectedValue));
  return valid && matches;
}

export function bearerTokenFromAuthorization(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(/^Bearer[ \t]+(.+)$/iu);
  const token = match?.[1]?.trim();
  if (!token || token.length > MAX_CRON_SECRET_LENGTH || /[\s\u0000-\u001f\u007f]/u.test(token)) {
    return null;
  }
  return token;
}
