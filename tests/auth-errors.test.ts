import { describe, expect, it } from "vitest";

import { describeSignupError, safeCallbackPath } from "../src/lib/validation/auth";

describe("auth signup error messaging", () => {
  it("returns a clear duplicate-email message", () => {
    expect(describeSignupError({ code: "P2002" })).toBe(
      "An account with this email already exists.",
    );
  });

  it("returns a generic retry message for missing env issues", () => {
    expect(
      describeSignupError(new Error("Environment variable not found: DATABASE_URL")),
    ).toContain("try again");
  });
});

describe("sign-in callback paths", () => {
  it("keeps local paths with query strings", () => {
    expect(safeCallbackPath("/accept-invitation?token=abc123")).toBe(
      "/accept-invitation?token=abc123",
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackPath("https://evil.example/steal")).toBeNull();
    expect(safeCallbackPath("//evil.example/steal")).toBeNull();
  });

  it("rejects backslash and javascript style payloads", () => {
    expect(safeCallbackPath("/\\evil.example")).toBeNull();
    expect(safeCallbackPath("/business\\..\\..\\evil")).toBeNull();
    expect(safeCallbackPath("javascript:alert(1)")).toBeNull();
  });

  it("rejects missing and non-string values", () => {
    expect(safeCallbackPath(null)).toBeNull();
    expect(safeCallbackPath(undefined)).toBeNull();
    expect(safeCallbackPath(new File([], "x"))).toBeNull();
  });
});
