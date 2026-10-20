export const MAX_SCAN_BYTES = 4 * 1024 * 1024;
export const MAX_SCAN_UPLOAD_LABEL = "4 MB";
export const MAX_SCAN_DIMENSION = 1700;
export const MAX_SCAN_COLUMNS = 60;
export const MAX_SCAN_ROWS = 2000;

export const SCAN_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;
