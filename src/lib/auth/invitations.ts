import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildLinkEmail, sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/env";

export const INVITATION_TOKEN_TTL_DAYS = 7;

export type InvitationDelivery = {
  configured: boolean;
  sent: boolean;
};

export type InvitationPreview = {
  valid: boolean;
  email: string;
  businessName: string;
  roleName: string;
  invitedByName: string;
  expiresAt: Date;
  alreadyMember: boolean;
  emailMatches: boolean | null;
};

export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function sendInvitationEmail(input: {
  email: string;
  token: string;
  businessName: string;
  roleName: string;
  invitedByName: string;
}): Promise<InvitationDelivery> {
  const invitationUrl = new URL("/accept-invitation", getAppUrl());
  invitationUrl.searchParams.set("token", input.token);
  const message = buildLinkEmail({
    heading: `Join ${input.businessName} on Rungika`,
    intro: `${input.invitedByName} invited you to join ${input.businessName} on Rungika as ${input.roleName}.`,
    linkText: "Accept invitation",
    url: invitationUrl.toString(),
    footnote: `This link expires in ${INVITATION_TOKEN_TTL_DAYS} days and can only be used by ${input.email}.`,
  });

  return sendEmail({ to: input.email, ...message });
}

export async function getInvitationPreview(
  token: string,
  currentUser: { id: string; email: string } | null,
): Promise<InvitationPreview | null> {
  const tokenHash = hashInvitationToken(token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      business: { select: { id: true, name: true } },
      role: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation) {
    return null;
  }

  const preview: InvitationPreview = {
    valid:
      invitation.status === "INVITED" &&
      invitation.expiresAt.getTime() > Date.now(),
    email: invitation.email,
    businessName: invitation.business.name,
    roleName: invitation.role.name,
    invitedByName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
    alreadyMember: false,
    emailMatches: null,
  };
  if (!preview.valid || !currentUser) {
    return preview;
  }

  preview.emailMatches = currentUser.email === invitation.email;
  if (!preview.emailMatches) {
    return preview;
  }

  const membership = await db.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId: invitation.business.id, userId: currentUser.id },
    },
    select: { id: true },
  });
  preview.alreadyMember = membership !== null;
  return preview;
}

export class InvitationError extends Error {}

export async function acceptInvitation(input: { token: string; userId: string }) {
  const tokenHash = hashInvitationToken(input.token);
  const now = new Date();

  return db.$transaction(async (transaction: Prisma.TransactionClient) => {
    const invitation = await transaction.invitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        businessId: true,
        roleId: true,
        email: true,
        phone: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        invitedById: true,
        business: { select: { name: true, status: true } },
        role: { select: { name: true } },
      },
    });
    if (!invitation) {
      throw new InvitationError("This invitation link is invalid or has expired.");
    }

    const user = await transaction.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, status: true, emailVerifiedAt: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new InvitationError("Sign in with the invited email to accept this invitation.");
    }
    if (user.email !== invitation.email) {
      throw new InvitationError(
        `This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`,
      );
    }
    if (!user.emailVerifiedAt) {
      throw new InvitationError("Verify your email before accepting this invitation.");
    }
    if (invitation.status !== "INVITED" || invitation.expiresAt.getTime() <= now.getTime()) {
      throw new InvitationError("This invitation link is invalid or has expired.");
    }
    if (invitation.business.status !== "ACTIVE") {
      throw new InvitationError("This business is not accepting new members right now.");
    }

    const consumed = await transaction.invitation.updateMany({
      where: { id: invitation.id, status: "INVITED", expiresAt: { gt: now } },
      data: {
        status: "ACTIVE",
        acceptedAt: now,
        acceptedById: user.id,
      },
    });
    if (consumed.count !== 1) {
      throw new InvitationError("This invitation link is invalid or has expired.");
    }

    const existing = await transaction.businessMembership.findUnique({
      where: {
        businessId_userId: { businessId: invitation.businessId, userId: user.id },
      },
      select: { id: true },
    });
    if (existing) {
      throw new InvitationError("You are already a member of this business.");
    }

    const membership = await transaction.businessMembership.create({
      data: {
        businessId: invitation.businessId,
        userId: user.id,
        roleId: invitation.roleId,
        status: "ACTIVE",
        invitedById: invitation.invitedById,
      },
    });
    await transaction.auditLog.create({
      data: {
        businessId: invitation.businessId,
        actorId: user.id,
        action: "PEOPLE.INVITATION_ACCEPTED",
        entityType: "Invitation",
        entityId: invitation.id,
        metadata: { roleId: invitation.roleId, membershipId: membership.id },
      },
    });
    await transaction.notification.createMany({
      data: [
        {
          businessId: invitation.businessId,
          userId: user.id,
          type: "SYSTEM",
          title: `You joined ${invitation.business.name}`,
          message: `You are now a member of ${invitation.business.name} as ${invitation.role.name}.`,
        },
        {
          businessId: invitation.businessId,
          userId: invitation.invitedById,
          type: "SYSTEM",
          title: "Invitation accepted",
          message: `${user.email} accepted the ${invitation.role.name} invitation for ${invitation.business.name}.`,
        },
      ],
    });

    return {
      businessId: invitation.businessId,
      businessName: invitation.business.name,
    };
  });
}
