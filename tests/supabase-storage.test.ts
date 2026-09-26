import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isSupabaseStorageConfigured,
  MissingSupabaseObjectError,
  SupabaseStorageError,
  supabaseDownloadObject,
  supabaseRemoveObject,
  supabaseUploadObject,
} from "../src/lib/storage/supabase-storage";
import { isMissingPrivateUpload } from "../src/lib/storage/private-upload";

const KEY = "123e4567-e89b-12d3-a456-426614174000.png";
const STORAGE_URL = "https://abcdefgh.supabase.co";
const SERVICE_KEY = "eyJ0ZXN0LXNlcnZpY2Utcm9sZS1rZXk";
const ENV_KEYS = [
  "SUPABASE_STORAGE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
] as const;

const originalEnv = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
}

function configureEnv(overrides: Record<string, string> = {}) {
  process.env.SUPABASE_STORAGE_URL = STORAGE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("supabase storage configuration", () => {
  it("is not configured without both values", () => {
    expect(isSupabaseStorageConfigured()).toBe(false);

    process.env.SUPABASE_STORAGE_URL = STORAGE_URL;
    expect(isSupabaseStorageConfigured()).toBe(false);

    process.env.SUPABASE_STORAGE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
    expect(isSupabaseStorageConfigured()).toBe(false);
  });

  it("is configured with a url and service role key", () => {
    configureEnv();
    expect(isSupabaseStorageConfigured()).toBe(true);
  });

  it("rejects a non https storage url", () => {
    configureEnv({ SUPABASE_STORAGE_URL: "http://abcdefgh.supabase.co" });
    expect(() => isSupabaseStorageConfigured()).toThrow(SupabaseStorageError);
  });

  it("rejects a storage url that is not an origin", () => {
    configureEnv({ SUPABASE_STORAGE_URL: "https://abcdefgh.supabase.co/evil" });
    expect(() => isSupabaseStorageConfigured()).toThrow(SupabaseStorageError);
  });

  it("rejects an invalid bucket name", () => {
    configureEnv({ SUPABASE_STORAGE_BUCKET: "Bad_Bucket!" });
    expect(() => isSupabaseStorageConfigured()).toThrow(SupabaseStorageError);
  });
});

describe("supabase storage upload", () => {
  it("posts to the object endpoint with service role auth", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const data = pngBytes();
    await supabaseUploadObject({
      key: KEY,
      data: data.buffer.slice(0) as ArrayBuffer,
      contentType: "image/png",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${STORAGE_URL}/storage/v1/object/payment-proofs/${KEY}`);
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe(SERVICE_KEY);
    expect(init.headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`);
    expect(init.headers["Content-Type"]).toBe("image/png");
    expect(init.headers["x-upsert"]).toBe("false");
  });

  it("honours a custom bucket name", async () => {
    configureEnv({ SUPABASE_STORAGE_BUCKET: "proofs" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await supabaseUploadObject({
      key: KEY,
      data: pngBytes().buffer.slice(0) as ArrayBuffer,
      contentType: "image/png",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${STORAGE_URL}/storage/v1/object/proofs/${KEY}`,
    );
  });

  // Supabase rejects new-style secret keys when they are sent as a bearer JWT,
  // and the legacy service_role key it replaces can no longer be rotated.
  it("sends a new-style secret key on the apikey header only", async () => {
    configureEnv({ SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc123" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await supabaseUploadObject({
      key: KEY,
      data: pngBytes().buffer.slice(0) as ArrayBuffer,
      contentType: "image/png",
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.apikey).toBe("sb_secret_abc123");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("keeps sending the bearer header for a legacy jwt key", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await supabaseUploadObject({
      key: KEY,
      data: pngBytes().buffer.slice(0) as ArrayBuffer,
      contentType: "image/png",
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.apikey).toBe(SERVICE_KEY);
    expect(init.headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`);
  });

  it("refuses an unsafe key before any request", async () => {
    configureEnv();
    await expect(
      supabaseUploadObject({
        key: "../../etc/passwd",
        data: pngBytes().buffer.slice(0) as ArrayBuffer,
        contentType: "image/png",
      }),
    ).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an oversized body before any request", async () => {
    configureEnv();
    await expect(
      supabaseUploadObject({
        key: KEY,
        data: new ArrayBuffer(0),
        contentType: "image/png",
      }),
    ).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from the storage api", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Bucket not found" }), { status: 404 }),
    );

    await expect(
      supabaseUploadObject({
        key: KEY,
        data: pngBytes().buffer.slice(0) as ArrayBuffer,
        contentType: "image/png",
      }),
    ).rejects.toThrow(/Bucket not found/u);
  });
});

describe("supabase storage download", () => {
  it("returns the object bytes and size", async () => {
    configureEnv();
    const data = pngBytes();
    fetchMock.mockResolvedValue(
      new Response(data.buffer.slice(0) as ArrayBuffer, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const result = await supabaseDownloadObject(KEY);
    expect(result.size).toBe(data.byteLength);
    expect(result.mime).toBe("image/png");
    expect(Array.from(result.data)).toEqual(Array.from(data));
  });

  it("maps a missing object to a missing-proof error", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(supabaseDownloadObject(KEY)).rejects.toBeInstanceOf(
      MissingSupabaseObjectError,
    );
  });

  it("reports a missing object through isMissingPrivateUpload", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    const error = await supabaseDownloadObject(KEY).catch((cause: unknown) => cause);
    expect(isMissingPrivateUpload(error)).toBe(true);
  });

  it("does not treat a server error as a missing object", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const error = await supabaseDownloadObject(KEY).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SupabaseStorageError);
    expect(isMissingPrivateUpload(error)).toBe(false);
  });

  it("rejects a stored object whose size is out of range", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response(new Uint8Array(0), { status: 200 }));

    await expect(supabaseDownloadObject(KEY)).rejects.toThrow(/not a valid size/u);
  });

  it("refuses a key with the wrong extension for its type", async () => {
    configureEnv();
    await expect(
      supabaseDownloadObject("123e4567-e89b-12d3-a456-426614174000.gif"),
    ).rejects.toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Cloudflare caches these responses, so a proof that had already been
  // downloaded once stayed readable after it was deleted. Every read must carry
  // a unique value so the edge asks the origin instead of serving a stale copy.
  it("sends a unique cache-busting value on every download", async () => {
    configureEnv();
    const data = pngBytes();
    fetchMock.mockImplementation(
      async () =>
        new Response(data.buffer.slice(0) as ArrayBuffer, { status: 200 }),
    );

    await supabaseDownloadObject(KEY);
    await supabaseDownloadObject(KEY);

    const [firstUrl, firstInit] = fetchMock.mock.calls[0];
    const [secondUrl] = fetchMock.mock.calls[1];
    const base = `${STORAGE_URL}/storage/v1/object/payment-proofs/${KEY}`;
    const bust = (url: string) => new URL(String(url)).searchParams.get("v");

    expect(bust(firstUrl)).toMatch(/^[0-9a-f-]{36}$/u);
    expect(bust(secondUrl)).toMatch(/^[0-9a-f-]{36}$/u);
    expect(bust(firstUrl)).not.toBe(bust(secondUrl));
    expect(String(firstUrl).startsWith(`${base}?`)).toBe(true);
    expect(firstInit.cache).toBe("no-store");
  });

  it("maps a 400 that reports a missing object to a missing-proof error", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Object not found" }), { status: 400 }),
    );

    await expect(supabaseDownloadObject(KEY)).rejects.toBeInstanceOf(
      MissingSupabaseObjectError,
    );
  });

  it("does not hide a 400 that is not about a missing object", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid key name" }), { status: 400 }),
    );

    const error = await supabaseDownloadObject(KEY).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SupabaseStorageError);
    expect(isMissingPrivateUpload(error)).toBe(false);
  });
});

describe("supabase storage removal", () => {
  it("deletes the object", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await supabaseRemoveObject(KEY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${STORAGE_URL}/storage/v1/object/payment-proofs/${KEY}`);
    expect(init.method).toBe("DELETE");
  });

  it("treats an already missing object as success", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(supabaseRemoveObject(KEY)).resolves.toBeUndefined();
  });

  it("surfaces a permission failure", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));

    await expect(supabaseRemoveObject(KEY)).rejects.toThrow(SupabaseStorageError);
  });

  it("treats a 400 reporting a missing object as success", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Object not found" }), { status: 400 }),
    );

    await expect(supabaseRemoveObject(KEY)).resolves.toBeUndefined();
  });

  it("does not swallow a 400 that is not about a missing object", async () => {
    configureEnv();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid key name" }), { status: 400 }),
    );

    await expect(supabaseRemoveObject(KEY)).rejects.toThrow(SupabaseStorageError);
  });
});
