export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PROOF_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "image/webp",
] as const;

export type ProofMimeType = (typeof ALLOWED_PROOF_MIME_TYPES)[number];

const MAX_PROOF_MIME_LENGTH = 128;

const PROOF_EXTENSIONS: Record<ProofMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
  "image/webp": "webp",
};

const PROOF_MIME_TYPES: Record<string, ProofMimeType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
};

const PRIVATE_UPLOAD_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|jpeg|pdf|webp)$/i;

export function normalizeProofMimeType(value: unknown): ProofMimeType | null {
  if (typeof value !== "string" || value.length > MAX_PROOF_MIME_LENGTH) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_PROOF_MIME_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ProofMimeType)
    : null;
}

function hasAsciiBytes(value: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((byte, index) => value[offset + index] === byte);
}

export function detectProofMimeType(value: unknown): ProofMimeType | null {
  if (!(value instanceof Uint8Array)) {
    return null;
  }
  if (hasAsciiBytes(value, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (hasAsciiBytes(value, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    value.length >= 12 &&
    hasAsciiBytes(value, [0x52, 0x49, 0x46, 0x46], 0) &&
    hasAsciiBytes(value, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  if (hasAsciiBytes(value, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  return null;
}

export function isProofContentForMime(value: unknown, mime: unknown): boolean {
  const normalizedMime = normalizeProofMimeType(mime);
  return normalizedMime !== null && detectProofMimeType(value) === normalizedMime;
}

export function isAllowedProofMimeType(value: unknown): value is ProofMimeType {
  return normalizeProofMimeType(value) !== null;
}

export function getProofExtension(value: unknown): string | null {
  const mimeType = normalizeProofMimeType(value);
  return mimeType ? PROOF_EXTENSIONS[mimeType] : null;
}

export function getProofMimeTypeForKey(value: unknown): ProofMimeType | null {
  if (typeof value !== "string" || !isSafePrivateUploadKey(value)) {
    return null;
  }
  const extension = value.slice(value.lastIndexOf(".") + 1).toLowerCase();
  return PROOF_MIME_TYPES[`.${extension}`] ?? null;
}

export function isConsistentProofStorageMetadata(key: unknown, mime: unknown): boolean {
  const keyMime = getProofMimeTypeForKey(key);
  if (!keyMime) {
    return false;
  }
  if (mime === null || mime === undefined || mime === "") {
    return true;
  }
  return normalizeProofMimeType(mime) === keyMime;
}

export function isValidProofSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_PROOF_BYTES
  );
}

export function isSafeOriginalFilename(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length < 1 || value.length > 255 || value.trim() !== value) {
    return false;
  }
  if (value === "." || value === "..") {
    return false;
  }
  if (/[\\/:*?"<>|\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  if (value.endsWith(".") || value.endsWith(" ")) {
    return false;
  }
  return true;
}

export function isSafePrivateUploadKey(value: unknown): value is string {
  return typeof value === "string" && PRIVATE_UPLOAD_KEY_PATTERN.test(value);
}

export const isSafeProofFilename = isSafeOriginalFilename;
export const isSafeUploadFilename = isSafeOriginalFilename;
export const isSafeUploadKey = isSafePrivateUploadKey;
export const getAllowedProofExtension = getProofExtension;
