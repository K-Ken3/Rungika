import "server-only";

import { getEmailProviderConfig } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = {
  configured: boolean;
  sent: boolean;
};

function stableReference(message: EmailMessage) {
  let hash = 0;
  const seed = `${message.to}|${message.subject}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildMailHeaders(message: EmailMessage) {
  return {
    "X-Entity-Ref-ID": stableReference(message),
    "Auto-Submitted": "auto-generated",
    "X-Mailer": "Rungika",
    "Precedence": "bulk",
  };
}

export function buildLinkEmail(input: {
  heading: string;
  intro: string;
  linkText: string;
  url: string;
  footnote: string;
}) {
  const safeUrl = input.url.replace(/"/gu, "%22");
  return {
    subject: `${input.heading} | Rungika`,
    text: [
      input.intro,
      `${input.linkText}: ${safeUrl}`,
      input.footnote,
      "If you did not expect this message you can ignore it.",
    ].join("\n\n"),
    html: [
      "<p style=\"font-family:system-ui,sans-serif;font-size:15px;line-height:1.6\">",
      input.intro,
      "</p>",
      "<p style=\"margin:22px 0\">",
      `<a href="${safeUrl}" style="background:#047857;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px">${input.linkText}</a>`,
      "</p>",
      "<p style=\"font-family:system-ui,sans-serif;font-size:13px;color:#475569;margin:0 0 16px\">",
      `If the button does not work, copy and paste this link into your browser:<br><span style=\"word-break:break-all\">${safeUrl}</span>`,
      "</p>",
      "<p style=\"font-family:system-ui,sans-serif;font-size:13px;color:#475569\">",
      input.footnote,
      "</p>",
      "<p style=\"font-family:system-ui,sans-serif;font-size:13px;color:#475569\">",
      "If you did not expect this message you can ignore it.",
      "</p>",
    ].join(""),
  };
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const provider = getEmailProviderConfig();
  if (!provider) {
    return { configured: false, sent: false };
  }

  try {
    if (provider.provider === "smtp" && provider.smtp) {
      const { createTransport } = await import("nodemailer");
      const transport = createTransport({
        host: provider.smtp.host,
        port: provider.smtp.port,
        secure: provider.smtp.secure,
        auth: {
          user: provider.smtp.user,
          pass: provider.smtp.password,
        },
        tls: {
          rejectUnauthorized: provider.smtp.rejectUnauthorized,
          minVersion: "TLSv1.2",
        },
      });
      const result = await transport.sendMail({
        from: provider.from,
        ...(provider.replyTo ? { replyTo: provider.replyTo } : {}),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: buildMailHeaders(message),
      });
      const accepted = Array.isArray(result.accepted) ? result.accepted.length > 0 : true;
      return { configured: true, sent: accepted };
    }

    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        provider.provider === "resend"
          ? {
              from: provider.from,
              ...(provider.replyTo ? { reply_to: provider.replyTo } : {}),
              to: [message.to],
              subject: message.subject,
              text: message.text,
              html: message.html,
              headers: buildMailHeaders(message),
            }
          : {
              from: provider.from,
              ...(provider.replyTo ? { reply_to: provider.replyTo } : {}),
              to: message.to,
              subject: message.subject,
              text: message.text,
              html: message.html,
              headers: buildMailHeaders(message),
            },
      ),
    });

    return { configured: true, sent: response.ok };
  } catch {
    return { configured: true, sent: false };
  }
}
