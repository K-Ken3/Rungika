import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getEmailProviderConfig } from "../src/lib/env";
import { buildLinkEmail } from "../src/lib/email/send";

const originalEnv = { ...process.env };

beforeEach(() => {
  for (const key of [
    "EMAIL_PROVIDER",
    "EMAIL_API_KEY",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
    "NEXT_PUBLIC_SUPPORT_EMAIL",
    "EMAIL_PROVIDER_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
  ]) {
    delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("email provider resolution", () => {
  it("returns null when nothing is configured", () => {
    expect(getEmailProviderConfig()).toBeNull();
  });

  it("resolves gmail over smtp with an app password", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.EMAIL_FROM = "Rungika <owner@gmail.com>";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "owner@gmail.com";
    process.env.SMTP_PASSWORD = "abcd efgh ijkl mnop";

    const provider = getEmailProviderConfig();
    expect(provider?.provider).toBe("smtp");
    expect(provider?.smtp?.host).toBe("smtp.gmail.com");
    expect(provider?.smtp?.port).toBe(587);
    expect(provider?.smtp?.secure).toBe(false);
  });

  it("enables implicit tls on port 465", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.EMAIL_FROM = "owner@gmail.com";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "owner@gmail.com";
    process.env.SMTP_PASSWORD = "secret";

    expect(getEmailProviderConfig()?.smtp?.secure).toBe(true);
  });

  it("refuses smtp without a complete configuration", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "owner@gmail.com";

    expect(getEmailProviderConfig()).toBeNull();
  });

  it("still resolves resend and webhook providers", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "no-reply@example.com";
    expect(getEmailProviderConfig()?.endpoint).toBe("https://api.resend.com/emails");

    process.env = { ...originalEnv };
    process.env.EMAIL_PROVIDER = "webhook";
    process.env.EMAIL_API_KEY = "key";
    process.env.EMAIL_FROM = "no-reply@example.com";
    process.env.EMAIL_PROVIDER_URL = "https://mail.example.com/send";
    expect(getEmailProviderConfig()?.endpoint).toBe("https://mail.example.com/send");
  });

  it("resolves resend on a verified sending domain", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "Rungika <no-reply@mail.example.com>";
    process.env.EMAIL_REPLY_TO = "support@example.com";

    const provider = getEmailProviderConfig();
    expect(provider?.provider).toBe("resend");
    expect(provider?.from).toBe("Rungika <no-reply@mail.example.com>");
    expect(provider?.replyTo).toBe("support@example.com");
  });

  it("falls back to the support address for reply-to", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "Rungika <no-reply@mail.example.com>";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@example.com";

    expect(getEmailProviderConfig()?.replyTo).toBe("help@example.com");
  });

  it("returns an empty reply-to when nothing is configured", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_123";
    process.env.EMAIL_FROM = "Rungika <no-reply@mail.example.com>";

    expect(getEmailProviderConfig()?.replyTo).toBe("");
  });
});

describe("link email template", () => {
  it("includes the action link in text and html", () => {
    const message = buildLinkEmail({
      heading: "Verify your email",
      intro: "Confirm your address.",
      linkText: "Verify my email",
      url: "https://app.example.com/verify-email?token=abc",
      footnote: "Expires in 24 hours.",
    });

    expect(message.subject).toContain("Verify your email");
    expect(message.text).toContain("https://app.example.com/verify-email?token=abc");
    expect(message.html).toContain("Verify my email");
    expect(message.html).toContain("Expires in 24 hours.");
  });

  it("escapes quotes in generated links", () => {
    const message = buildLinkEmail({
      heading: "Join",
      intro: "You were invited.",
      linkText: "Accept",
      url: 'https://app.example.com/accept-invitation?token=a"onload="alert(1)',
      footnote: "Expires in 7 days.",
    });

    expect(message.html).not.toContain('a"onload="alert(1)');
    expect(message.html).toContain("%22");
  });

  it("renders the call to action as a styled html button", () => {
    const message = buildLinkEmail({
      heading: "Verify your email",
      intro: "Confirm your address.",
      linkText: "Verify my email",
      url: "https://app.example.com/verify-email?token=abc",
      footnote: "Expires in 24 hours.",
    });

    expect(message.html).toMatch(
      /<a href="https:\/\/app\.example\.com\/verify-email\?token=abc"[^>]*>Verify my email<\/a>/,
    );
    expect(message.html).toContain("background:#047857");
  });

  it("keeps a copy and paste url fallback in the html body", () => {
    const message = buildLinkEmail({
      heading: "Reset your password",
      intro: "Choose a new password.",
      linkText: "Reset my password",
      url: "https://app.example.com/reset-password?token=abc",
      footnote: "Expires in 1 hour.",
    });

    expect(message.html).toContain("copy and paste this link");
    expect(message.html).toContain("https://app.example.com/reset-password?token=abc");
  });
});
