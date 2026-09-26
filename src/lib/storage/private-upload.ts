import "server-only";

import { randomUUID } from "node:crypto";

import {
  getProofExtension,
  getProofMimeTypeForKey,
  isProofContentForMime,
  isSafeOriginalFilename,
  isValidProofSize,
  normalizeProofMimeType,
  type ProofMimeType,
} from "./private-upload-rules";
import {
  isSupabaseStorageConfigured,
  MissingSupabaseObjectError,
  supabaseDownloadObject,
  supabaseRemoveObject,
  supabaseUploadObject,
} from "./supabase-storage";

export type PrivateUploadMetadata = Readonly<{
  key: string;
  name: string;
  mime: ProofMimeType;
  size: number;
}>;

export type PrivateUploadFile = Readonly<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  mime: ProofMimeType;
}>;

async function localStorage() {
  return import("./local-private-upload");
}

export async function savePrivateUpload(file: File): Promise<PrivateUploadMetadata> {
  const mime = normalizeProofMimeType(file.type);
  if (!mime || !isSafeOriginalFilename(file.name) || !isValidProofSize(file.size)) {
    throw new TypeError("Invalid private upload");
  }
  const data = Buffer.from(await file.arrayBuffer());
  if (!isValidProofSize(data.byteLength) || !isProofContentForMime(data, mime)) {
    throw new TypeError("Invalid private upload");
  }
  const extension = getProofExtension(mime);
  if (!extension) {
    throw new TypeError("Invalid private upload");
  }
  const key = `${randomUUID()}.${extension}`;

  if (isSupabaseStorageConfigured()) {
    await supabaseUploadObject({
      key,
      data: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer,
      contentType: mime,
    });
  } else {
    const local = await localStorage();
    await local.saveLocalPrivateUpload(key, data);
  }

  return { key, name: file.name, mime, size: data.byteLength };
}

export function resolveProofContentType(mime: unknown, key: string): string {
  return getProofMimeTypeForKey(key) ?? normalizeProofMimeType(mime) ?? "application/octet-stream";
}

export async function openPrivateUpload(key: string): Promise<PrivateUploadFile> {
  if (isSupabaseStorageConfigured()) {
    const object = await supabaseDownloadObject(key);
    if (!object.mime) {
      throw new Error("Private upload is not a valid proof file");
    }
    if (!isProofContentForMime(object.data, object.mime)) {
      throw new Error("Private upload content does not match its type");
    }
    return {
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(object.data);
          controller.close();
        },
      }),
      size: object.size,
      mime: object.mime,
    };
  }

  const local = await localStorage();
  return local.openLocalPrivateUpload(key);
}

export async function removePrivateUpload(key: string): Promise<void> {
  if (isSupabaseStorageConfigured()) {
    await supabaseRemoveObject(key);
    return;
  }
  const local = await localStorage();
  await local.removeLocalPrivateUpload(key);
}

export function isMissingPrivateUpload(error: unknown): boolean {
  if (error instanceof MissingSupabaseObjectError) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
