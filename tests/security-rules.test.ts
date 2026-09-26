import { describe, expect, it } from "vitest";

import {
  getProofExtension,
  getProofMimeTypeForKey,
  isAllowedProofMimeType,
  isSafeOriginalFilename,
  isSafePrivateUploadKey,
  isValidProofSize,
  MAX_PROOF_BYTES,
} from "../src/lib/storage/private-upload-rules";
import {
  createRateLimitKey,
  getRateLimitWindow,
  RATE_LIMIT_ACTIONS,
} from "../src/lib/security/rate-limit-rules";
import {
  contentDispositionAttachment,
  safeDownloadFilename,
  serializeCsv,
} from "../src/lib/security/csv";
import {
  bearerTokenFromAuthorization,
  safeSecretMatches,
} from "../src/lib/security/cron-rules";

const KEY = "123e4567-e89b-12d3-a456-426614174000.png";
const NOW = new Date("2026-09-25T12:34:56.789Z");

describe("private upload rules", () => {
  it("allows only the configured proof MIME types", () => {
    expect(isAllowedProofMimeType("image/png")).toBe(true);
    expect(isAllowedProofMimeType("IMAGE/JPEG")).toBe(true);
    expect(isAllowedProofMimeType("text/html")).toBe(false);
    expect(getProofExtension("application/pdf")).toBe("pdf");
    expect(getProofExtension("image/gif")).toBeNull();
  });

  it("rejects unsafe original filenames", () => {
    expect(isSafeOriginalFilename("payment-proof.pdf")).toBe(true);
    expect(isSafeOriginalFilename("payment proof (1).pdf")).toBe(true);
    expect(isSafeOriginalFilename("../payment.pdf")).toBe(false);
    expect(isSafeOriginalFilename("..\\payment.pdf")).toBe(false);
    expect(isSafeOriginalFilename("payment\r\n.pdf")).toBe(false);
    expect(isSafeOriginalFilename("C:payment.pdf")).toBe(false);
  });

  it("requires generated UUID keys and bounded proof sizes", () => {
    expect(isSafePrivateUploadKey(KEY)).toBe(true);
    expect(isSafePrivateUploadKey("proof.pdf")).toBe(false);
    expect(isSafePrivateUploadKey("../123e4567-e89b-12d3-a456-426614174000.png")).toBe(false);
    expect(getProofMimeTypeForKey(KEY)).toBe("image/png");
    expect(isValidProofSize(MAX_PROOF_BYTES)).toBe(true);
    expect(isValidProofSize(MAX_PROOF_BYTES + 1)).toBe(false);
    expect(isValidProofSize(0)).toBe(false);
  });
});

describe("rate limit key rules", () => {
  it("uses a stable fixed-window hash without exposing identifiers", () => {
    const first = createRateLimitKey(RATE_LIMIT_ACTIONS.TABLE_EXPORT, "user-123", NOW);
    const second = createRateLimitKey(RATE_LIMIT_ACTIONS.TABLE_EXPORT, "user-123", NOW);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain("user-123");
  });

  it("separates actions, identifiers, and windows", () => {
    const base = createRateLimitKey(RATE_LIMIT_ACTIONS.CLAIM_PROOF, "user-123", NOW);
    expect(createRateLimitKey(RATE_LIMIT_ACTIONS.TABLE_EXPORT, "user-123", NOW)).not.toBe(base);
    expect(createRateLimitKey(RATE_LIMIT_ACTIONS.CLAIM_PROOF, "user-456", NOW)).not.toBe(base);
    expect(
      createRateLimitKey(
        RATE_LIMIT_ACTIONS.CLAIM_PROOF,
        "user-123",
        new Date(NOW.getTime() + 60_000),
      ),
    ).not.toBe(base);
  });

  it("calculates aligned fixed windows", () => {
    const window = getRateLimitWindow(NOW, 60_000);
    expect(window.start.toISOString()).toBe("2026-09-25T12:34:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-25T12:35:00.000Z");
  });
});

describe("CSV safety", () => {
  it("neutralizes spreadsheet formulas and quotes cells", () => {
    expect(
      serializeCsv(
        ["name", "value"],
        [
          ["=SUM(A1:A2)", 'a"b'],
          ["\tunsafe", "-1"],
        ],
      ),
    ).toBe(
      '"name","value"\r\n"\'=SUM(A1:A2)","a""b"\r\n"\'\tunsafe","\'-1"\r\n',
    );
  });

  it("removes path components from download names", () => {
    expect(safeDownloadFilename("../../secret.pdf")).toBe("secret.pdf");
    expect(contentDispositionAttachment("secret.pdf")).toContain("attachment;");
  });
});

describe("cron authentication rules", () => {
  it("compares secrets without accepting malformed bearer values", () => {
    expect(safeSecretMatches("correct", "correct")).toBe(true);
    expect(safeSecretMatches("wrong", "correct")).toBe(false);
    expect(bearerTokenFromAuthorization("Bearer correct")).toBe("correct");
    expect(bearerTokenFromAuthorization("Basic correct")).toBeNull();
  });
});
