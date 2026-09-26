import "server-only";

export type EmailProviderName = "resend" | "webhook" | "smtp";

export type EmailProviderConfig = Readonly<{
  provider: EmailProviderName;
  endpoint: string;
  apiKey: string;
  from: string;
  replyTo: string;
  smtp: Readonly<{
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
    rejectUnauthorized: boolean;
  }> | null;
}>;

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getAppUrl() {
  const configuredUrl = firstNonEmpty(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  );
  const fallbackUrl = "http://localhost:3000";

  if (!configuredUrl) {
    return fallbackUrl;
  }

  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return fallbackUrl;
    }
    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return fallbackUrl;
  }
}

export function getEmailProviderConfig(): EmailProviderConfig | null {
  const configuredProvider = firstNonEmpty(process.env.EMAIL_PROVIDER).toLowerCase();
  const apiKey = firstNonEmpty(
    process.env.EMAIL_API_KEY,
    process.env.RESEND_API_KEY,
  );
  const from = firstNonEmpty(process.env.EMAIL_FROM);
  const replyTo = firstNonEmpty(
    process.env.EMAIL_REPLY_TO,
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  );
  const webhookEndpoint = firstNonEmpty(process.env.EMAIL_PROVIDER_URL);
  const smtpUser = firstNonEmpty(
    process.env.SMTP_USER,
    process.env.EMAIL_API_KEY,
  );
  const smtpPassword = firstNonEmpty(
    process.env.SMTP_PASSWORD,
    process.env.EMAIL_API_KEY,
  );
  const smtpHost = firstNonEmpty(process.env.SMTP_HOST);
  const smtpPort = Number.parseInt(firstNonEmpty(process.env.SMTP_PORT) || "587", 10);
  const smtpSecure =
    firstNonEmpty(process.env.SMTP_SECURE).toLowerCase() === "true" ||
    smtpPort === 465;
  const smtpRejectUnauthorized =
    firstNonEmpty(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, "true").toLowerCase() !==
    "false";

  if (configuredProvider === "smtp" && smtpHost && smtpUser && smtpPassword && from) {
    return {
      provider: "smtp",
      endpoint: `smtp://${smtpHost}:${smtpPort}`,
      apiKey: "",
      from,
      replyTo,
      smtp: {
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        user: smtpUser,
        password: smtpPassword,
        secure: smtpSecure,
        rejectUnauthorized: smtpRejectUnauthorized,
      },
    };
  }

  if (configuredProvider === "webhook" && apiKey && from && webhookEndpoint) {
    return {
      provider: "webhook",
      endpoint: webhookEndpoint,
      apiKey,
      from,
      replyTo,
      smtp: null,
    };
  }

  const resendProvider = configuredProvider === "resend" ||
    (!configuredProvider && Boolean(firstNonEmpty(process.env.RESEND_API_KEY)));

  if (resendProvider && apiKey && from) {
    return {
      provider: "resend",
      endpoint: "https://api.resend.com/emails",
      apiKey,
      from,
      replyTo,
      smtp: null,
    };
  }

  return null;
}

export function isEmailProviderConfigured() {
  return getEmailProviderConfig() !== null;
}
