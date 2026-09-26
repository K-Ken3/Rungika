import "server-only";

import {
  getProofMimeTypeForKey,
  isSafePrivateUploadKey,
  isValidProofSize,
} from "./private-upload-rules";

export const SUPABASE_STORAGE_BUCKET_ENV_VAR = "SUPABASE_STORAGE_BUCKET";
export const SUPABASE_STORAGE_URL_ENV_VAR = "SUPABASE_STORAGE_URL";
export const SUPABASE_SERVICE_ROLE_KEY_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
export const SUPABASE_STORAGE_DEFAULT_BUCKET = "payment-proofs";

export class SupabaseStorageError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupabaseStorageError";
    this.status = status;
  }
}

export class MissingSupabaseObjectError extends SupabaseStorageError {
  constructor() {
    super("Supabase object not found", 404);
    this.name = "MissingSupabaseObjectError";
  }
}

type SupabaseStorageConfig = Readonly<{
  baseUrl: string;
  serviceRoleKey: string;
  bucket: string;
}>;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(readSupabaseStorageConfig());
}

function readSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const baseUrl = process.env[SUPABASE_STORAGE_URL_ENV_VAR]?.trim().replace(/\/+$/u, "");
  const serviceRoleKey = process.env[SUPABASE_SERVICE_ROLE_KEY_ENV_VAR]?.trim();
  if (!baseUrl || !serviceRoleKey) {
    return null;
  }
  if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.[a-z]{2,}$/iu.test(baseUrl)) {
    throw new SupabaseStorageError("Supabase storage URL is not a valid https origin", 500);
  }
  const bucket =
    process.env[SUPABASE_STORAGE_BUCKET_ENV_VAR]?.trim() ||
    SUPABASE_STORAGE_DEFAULT_BUCKET;
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)) {
    throw new SupabaseStorageError("Supabase storage bucket name is invalid", 500);
  }
  return { baseUrl, serviceRoleKey, bucket };
}

function requireConfig(): SupabaseStorageConfig {
  const config = readSupabaseStorageConfig();
  if (!config) {
    throw new SupabaseStorageError("Supabase storage is not configured", 503);
  }
  return config;
}

function objectUrl(
  config: SupabaseStorageConfig,
  key: string,
  cacheBust?: string,
): string {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const base = `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedKey}`;
  return cacheBust ? `${base}?v=${cacheBust}` : base;
}

function authHeaders(config: SupabaseStorageConfig): Record<string, string> {
  // The apikey header alone authenticates both key formats. New-style secret
  // keys (sb_secret_...) are not JWTs, and the platform rejects them outright if
  // they are sent as Authorization: Bearer, so the bearer header is only added
  // for legacy service_role JWTs, which are being deprecated by Supabase.
  const headers: Record<string, string> = { apikey: config.serviceRoleKey };
  if (config.serviceRoleKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${config.serviceRoleKey}`;
  }
  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return response.statusText || "Supabase storage request failed";
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as { message?: unknown; error?: unknown };
        const message = record.message ?? record.error;
        if (typeof message === "string" && message.length > 0) {
          return message.slice(0, 500);
        }
      }
    } catch {
      return text.slice(0, 500);
    }
    return text.slice(0, 500);
  } catch {
    return "Supabase storage request failed";
  }
}

export async function supabaseUploadObject(input: {
  key: string;
  data: ArrayBuffer;
  contentType: string;
}): Promise<void> {
  if (!isSafePrivateUploadKey(input.key)) {
    throw new TypeError("Invalid private upload");
  }
  if (!isValidProofSize(input.data.byteLength)) {
    throw new TypeError("Invalid private upload");
  }
  const config = requireConfig();
  const response = await fetch(objectUrl(config, input.key), {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "Content-Type": input.contentType,
      "x-upsert": "false",
      "Cache-Control": "no-store",
    },
    body: input.data,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SupabaseStorageError(
      `Supabase storage rejected the upload: ${await readErrorMessage(response)}`,
      response.status,
    );
  }
}

export async function supabaseDownloadObject(key: string): Promise<{
  data: Uint8Array;
  size: number;
  mime: ReturnType<typeof getProofMimeTypeForKey>;
}> {
  if (!isSafePrivateUploadKey(key)) {
    throw new TypeError("Invalid private upload");
  }
  const mime = getProofMimeTypeForKey(key);
  if (!mime) {
    throw new TypeError("Invalid private upload");
  }
  const config = requireConfig();
  // Cloudflare caches authenticated responses from the storage API. Without a
  // unique query string, a proof that has already been fetched once is still
  // served from the edge cache after it is deleted, so the delete does not take
  // effect for anyone who downloaded it. A per-request value forces a MISS and
  // makes the origin answer with the object's real state.
  const response = await fetch(
    objectUrl(config, key, crypto.randomUUID()),
    {
      method: "GET",
      headers: authHeaders(config),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    if (response.status === 404) {
      throw new MissingSupabaseObjectError();
    }
    if (response.status === 400) {
      const message = await readErrorMessage(response);
      if (/not found|does not exist|missing/iu.test(message)) {
        throw new MissingSupabaseObjectError();
      }
      throw new SupabaseStorageError(
        `Supabase storage could not read the object: ${message}`,
        response.status,
      );
    }
    throw new SupabaseStorageError(
      `Supabase storage could not read the object: ${await readErrorMessage(response)}`,
      response.status,
    );
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (!isValidProofSize(buffer.byteLength)) {
    throw new SupabaseStorageError("Stored proof is not a valid size", 500);
  }
  return { data: buffer, size: buffer.byteLength, mime };
}

export async function supabaseRemoveObject(key: string): Promise<void> {
  if (!isSafePrivateUploadKey(key)) {
    throw new TypeError("Invalid private upload");
  }
  const config = requireConfig();
  const response = await fetch(objectUrl(config, key), {
    method: "DELETE",
    headers: authHeaders(config),
    cache: "no-store",
  });
  if (response.ok) {
    return;
  }
  if (response.status === 404) {
    return;
  }
  if (response.status === 400) {
    const message = await readErrorMessage(response);
    if (/not found|does not exist|missing/iu.test(message)) {
      return;
    }
    throw new SupabaseStorageError(
      `Supabase storage could not remove the object: ${message}`,
      response.status,
    );
  }
  throw new SupabaseStorageError(
    `Supabase storage could not remove the object: ${await readErrorMessage(response)}`,
    response.status,
  );
}
