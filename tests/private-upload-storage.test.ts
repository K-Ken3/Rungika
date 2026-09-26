import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  isMissingPrivateUpload,
  openPrivateUpload,
  removePrivateUpload,
  savePrivateUpload,
} from "../src/lib/storage/private-upload";
import {
  PRIVATE_UPLOAD_ENV_VAR,
  resolvePrivateUploadPath,
} from "../src/lib/storage/local-private-upload";
import { isSupabaseStorageConfigured } from "../src/lib/storage/supabase-storage";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22]);

let root: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  delete process.env.SUPABASE_STORAGE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(isSupabaseStorageConfigured()).toBe(false);

  root = await mkdtemp(path.join(tmpdir(), "rungika-proofs-"));
  process.env[PRIVATE_UPLOAD_ENV_VAR] = root;
});

afterEach(async () => {
  process.env = { ...originalEnv };
  await rm(root, { recursive: true, force: true });
});

function proofFile(name = "proof.png", type = "image/png") {
  return new File([PNG], name, { type });
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: number[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(...value);
  }
  return Uint8Array.from(chunks);
}

describe("local private upload storage", () => {
  it("round trips a proof through save, open, and remove", async () => {
    const saved = await savePrivateUpload(proofFile());
    expect(saved.mime).toBe("image/png");
    expect(saved.size).toBe(PNG.byteLength);
    expect(saved.key).toMatch(/\.png$/u);

    const opened = await openPrivateUpload(saved.key);
    expect(opened.mime).toBe("image/png");
    expect(opened.size).toBe(PNG.byteLength);
    expect(Array.from(await readAll(opened.stream))).toEqual(Array.from(PNG));

    await removePrivateUpload(saved.key);
    await expect(openPrivateUpload(saved.key)).rejects.toSatisfy(isMissingPrivateUpload);
  });

  it("rejects a file whose bytes do not match its declared type", async () => {
    const mismatched = new File(["not really a png at all"], "proof.png", {
      type: "image/png",
    });
    await expect(savePrivateUpload(mismatched)).rejects.toThrow(TypeError);
  });

  it("rejects a disallowed mime type", async () => {
    await expect(
      savePrivateUpload(new File(["<svg/>"], "proof.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow(TypeError);
  });

  it("rejects an unsafe original filename", async () => {
    await expect(savePrivateUpload(proofFile("../escape.png"))).rejects.toThrow(TypeError);
  });

  it("refuses to resolve a key that escapes the root", () => {
    expect(() => resolvePrivateUploadPath("../../secrets.png", root)).toThrow();
  });
});
