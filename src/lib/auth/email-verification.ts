import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildLinkEmail, sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/env";

export const EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const EMAIL_VERIFICATION_TOKEN_TTL_MS =
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000;

export type EmailVerificationDelivery = {
  configured: boolean;
  sent: boolean;
};

export function generateEmailVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function issueEmailVerificationToken(userId: string) {
  const token = generateEmailVerificationToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS);

  await db.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });
  await db.emailVerificationToken.create({
    data: {
      tokenHash: hashEmailVerificationToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function invalidateEmailVerificationToken(token: string) {
  await db.emailVerificationToken.deleteMany({
    where: { tokenHash: hashEmailVerificationToken(token) },
  });
}

export async function sendEmailVerificationEmail(
  email: string,
  token: string,
  callbackUrl?: string,
): Promise<EmailVerificationDelivery> {
  const verificationUrl = new URL("/verify-email", getAppUrl());
  verificationUrl.searchParams.set("token", token);
  if (callbackUrl) {
    verificationUrl.searchParams.set("callbackUrl", callbackUrl);
  }
  const email_ = buildLinkEmail({
    heading: "Verify your email",
    intro: "Verify your Rungika account to finish setting up access to your workspace.",
    linkText: "Verify my email",
    url: verificationUrl.toString(),
    footnote: `This link expires in ${EMAIL_VERIFICATION_TOKEN_TTL_SECONDS / 3600} hours and can only be used once.`,
  });

  return sendEmail({ to: email, ...email_ });
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();

  return db.$transaction(async (transaction: Prisma.TransactionClient) => {
    const verificationToken = await transaction.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { status: true } },
      },
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt.getTime() <= now.getTime() ||
      verificationToken.user.status !== "ACTIVE"
    ) {
      return null;
    }

    const consumed = await transaction.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      return null;
    }

    await transaction.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: now },
    });
    return verificationToken.userId;
  });
}

export const createEmailVerificationToken = issueEmailVerificationToken;
