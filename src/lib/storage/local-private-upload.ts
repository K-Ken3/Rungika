import "server-only";

import { constants as fsConstants } from "node:fs";
import { chmod, lstat, mkdir, open, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  detectProofMimeType,
  getProofMimeTypeForKey,
  isSafePrivateUploadKey,
  isValidProofSize,
  type ProofMimeType,
} from "./private-upload-rules";

export const PRIVATE_UPLOAD_DEFAULT_DIRECTORY = "var/uploads";
export const PRIVATE_UPLOAD_ENV_VAR = "PRIVATE_UPLOAD_DIR";

export type LocalPrivateUploadFile = Readonly<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  mime: ProofMimeType;
}>;

type PrivateFileInfo = Readonly<{
  filePath: string;
  size: number;
}>;

export function getPrivateUploadRoot(): string {
  const configured = process.env[PRIVATE_UPLOAD_ENV_VAR]?.trim();
  return path.resolve(configured || PRIVATE_UPLOAD_DEFAULT_DIRECTORY);
}

function isPathOutsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ""
  );
}

export function resolvePrivateUploadPath(
  key: string,
  root: string = getPrivateUploadRoot(),
): string {
  if (!isSafePrivateUploadKey(key)) {
    throw new Error("Invalid private upload key");
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, key);
  if (isPathOutsideRoot(resolvedRoot, candidate)) {
    throw new Error("Invalid private upload path");
  }
  return candidate;
}

async function ensurePrivateUploadRoot(root: string): Promise<string> {
  const resolvedRoot = path.resolve(root);
  await mkdir(resolvedRoot, { recursive: true, mode: 0o700 });
  const rootStats = await lstat(resolvedRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error("Private upload root is not a directory");
  }
  await chmod(resolvedRoot, 0o700);
  return realpath(resolvedRoot);
}

async function inspectPrivateUpload(
  key: string,
  root: string,
): Promise<PrivateFileInfo> {
  const resolvedRoot = path.resolve(root);
  const rootStats = await lstat(resolvedRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error("Private upload root is not a directory");
  }
  const canonicalRoot = await realpath(resolvedRoot);
  const filePath = resolvePrivateUploadPath(key, canonicalRoot);
  const fileStats = await lstat(filePath);
  if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
    throw new Error("Private upload is not a regular file");
  }
  const canonicalFilePath = await realpath(filePath);
  if (isPathOutsideRoot(canonicalRoot, canonicalFilePath)) {
    throw new Error("Private upload path escaped its root");
  }
  const canonicalStats = await lstat(canonicalFilePath);
  if (canonicalStats.isSymbolicLink() || !canonicalStats.isFile()) {
    throw new Error("Private upload is not a regular file");
  }
  return { filePath: canonicalFilePath, size: canonicalStats.size };
}

export async function saveLocalPrivateUpload(
  key: string,
  data: Uint8Array,
): Promise<void> {
  const root = path.resolve(getPrivateUploadRoot());
  const canonicalRoot = await ensurePrivateUploadRoot(root);
  const filePath = resolvePrivateUploadPath(key, canonicalRoot);
  await writeFile(filePath, data, { flag: "wx", mode: 0o600 });
  await chmod(filePath, 0o600);
}

export async function openLocalPrivateUpload(key: string): Promise<LocalPrivateUploadFile> {
  const { filePath } = await inspectPrivateUpload(key, getPrivateUploadRoot());
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await open(filePath, fsConstants.O_RDONLY | noFollow);
  try {
    const stats = await handle.stat();
    const mime = getProofMimeTypeForKey(key);
    if (!stats.isFile() || !mime || !isValidProofSize(stats.size)) {
      throw new Error("Private upload is not a valid proof file");
    }
    const prefix = Buffer.alloc(Math.min(16, stats.size));
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    if (bytesRead !== prefix.length || detectProofMimeType(prefix) !== mime) {
      throw new Error("Private upload content does not match its type");
    }
    const stream = handle.createReadStream({
      autoClose: true,
      start: 0,
      end: stats.size - 1,
    });
    return {
      stream: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      size: stats.size,
      mime,
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function removeLocalPrivateUpload(key: string): Promise<void> {
  const { filePath } = await inspectPrivateUpload(key, getPrivateUploadRoot());
  await unlink(filePath);
}
