import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildLinkEmail, sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;
export const PASSWORD_RESET_TOKEN_TTL_MS =
  PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000;

export type PasswordResetDelivery = {
  configured: boolean;
  sent: boolean;
};

export function generatePasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function issuePasswordResetToken(userId: string) {
  const token = generatePasswordResetToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

  await db.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  });

  await db.passwordResetToken.create({
    data: {
      tokenHash: hashPasswordResetToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function invalidatePasswordResetToken(token: string) {
  await db.passwordResetToken.deleteMany({
    where: { tokenHash: hashPasswordResetToken(token) },
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<PasswordResetDelivery> {
  const resetUrl = new URL("/reset-password", getAppUrl());
  resetUrl.searchParams.set("token", token);
  const message = buildLinkEmail({
    heading: "Reset your password",
    intro: "A password reset was requested for your Rungika account.",
    linkText: "Choose a new password",
    url: resetUrl.toString(),
    footnote: `This link expires in ${PASSWORD_RESET_TOKEN_TTL_SECONDS / 60} minutes and can only be used once.`,
  });

  return sendEmail({ to: email, ...message });
}

export async function consumePasswordResetToken(
  token: string,
  password: string,
) {
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await hashPassword(password);
  const now = new Date();

  return db.$transaction(async (transaction: Prisma.TransactionClient) => {
    const resetToken = await transaction.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: {
          select: { status: true },
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= now.getTime() ||
      resetToken.user.status !== "ACTIVE"
    ) {
      return null;
    }

    const consumed = await transaction.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      return null;
    }

    await transaction.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });
    await transaction.session.deleteMany({
      where: { userId: resetToken.userId },
    });

    return resetToken.userId;
  });
}

export const createPasswordResetToken = issuePasswordResetToken;
