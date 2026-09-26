import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { isProduction } from "@/lib/env";
import {
  isMembershipRole,
  type MembershipRole,
} from "@/lib/permissions";
import type {
  AuthAdminMembership,
  AuthBusinessMembership,
  AuthBusinessStatus,
  AuthMembershipStatus,
  AuthSession,
  AuthUser,
  AuthUserStatus,
} from "@/lib/auth/types";

export const SESSION_COOKIE_NAME = "rungika_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;

type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    emailVerifiedAt: Date | null;
    adminMembership?: {
      role: string;
      active: boolean;
    } | null;
    memberships?: Array<{
      id: string;
      businessId: string;
      status: string;
      role?: {
        name: string;
      } | null;
      business?: {
        id: string;
        name: string;
        slug: string;
        status: string;
      } | null;
    }>;
  };
};

function toAuthUserStatus(value: string): AuthUserStatus {
  return value === "ACTIVE" ? "ACTIVE" : "DISABLED";
}

function toAuthMembershipStatus(value: string): AuthMembershipStatus {
  if (value === "INVITED" || value === "INACTIVE") {
    return value;
  }
  return "INACTIVE";
}

function toAuthBusinessStatus(value: string): AuthBusinessStatus {
  if (
    value === "PENDING_PAYMENT" ||
    value === "ACTIVE" ||
    value === "GRACE_PERIOD" ||
    value === "PAUSED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return "PENDING_PAYMENT";
}

function toMembershipRole(value: string | undefined): MembershipRole | null {
  if (!value) {
    return null;
  }
  const normalizedValue = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return isMembershipRole(normalizedValue) ? normalizedValue : null;
}

function toAdminMembership(
  value: { role: string; active: boolean } | null | undefined,
): AuthAdminMembership | null {
  if (!value) {
    return null;
  }
  const roles = ["SUPER_ADMIN", "FINANCE", "SUPPORT", "AUDITOR"] as const;
  if (!roles.includes(value.role as (typeof roles)[number])) {
    return null;
  }
  return {
    role: value.role as AuthAdminMembership["role"],
    active: value.active,
  };
}

function toBusinessMembership(
  value: NonNullable<SessionRecord["user"]["memberships"]>[number],
): AuthBusinessMembership | null {
  if (!value.business) {
    return null;
  }
  return {
    id: value.id,
    businessId: value.businessId,
    role: toMembershipRole(value.role?.name),
    status: toAuthMembershipStatus(value.status),
    business: {
      id: value.business.id,
      name: value.business.name,
      slug: value.business.slug,
      status: toAuthBusinessStatus(value.business.status),
    },
  };
}

function toAuthUser(record: SessionRecord["user"]): AuthUser {
  const memberships = (record.memberships ?? [])
    .map(toBusinessMembership)
    .filter((membership): membership is AuthBusinessMembership => membership !== null);

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    status: toAuthUserStatus(record.status),
    emailVerifiedAt: record.emailVerifiedAt,
    adminMembership: toAdminMembership(record.adminMembership),
    memberships,
  };
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashToken(token: string) {
  return hashSessionToken(token);
}

export function isValidSessionToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

async function getRequestMetadata(): Promise<SessionMetadata> {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      requestHeaders.get("x-client-ip");
    const userAgent = requestHeaders.get("user-agent");

    return {
      ipAddress: ipAddress ? ipAddress.slice(0, 255) : null,
      userAgent: userAgent ? userAgent.slice(0, 512) : null,
    };
  } catch {
    return {
      ipAddress: null,
      userAgent: null,
    };
  }
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function createSession(
  userId: string,
  metadata?: SessionMetadata,
): Promise<{ expiresAt: Date }> {
  if (!userId) {
    throw new Error("A user is required to create a session");
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const requestMetadata = metadata ?? (await getRequestMetadata());

  await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ipAddress: requestMetadata.ipAddress ?? null,
      userAgent: requestMetadata.userAgent ?? null,
    },
  });

  await setSessionCookie(token, expiresAt);
  return { expiresAt };
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  let deletionError: unknown;

  if (token && isValidSessionToken(token)) {
    try {
      await db.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    } catch (error) {
      deletionError = error;
    }
  }

  await clearSessionCookie();
  if (deletionError) {
    throw deletionError;
  }
}

export async function deleteSession() {
  return deleteCurrentSession();
}

export async function revokeUserSessions(userId: string) {
  if (!userId) {
    return;
  }
  await db.session.deleteMany({ where: { userId } });
}

export async function revokeSessionsForUser(userId: string) {
  return revokeUserSessions(userId);
}

async function readCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !isValidSessionToken(token)) {
    return null;
  }

  try {
    const record = (await db.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            adminMembership: true,
            memberships: {
              where: { status: "ACTIVE" },
              include: {
                business: true,
                role: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    })) as SessionRecord | null;

    if (!record) {
      return null;
    }

    if (
      record.expiresAt.getTime() <= Date.now() ||
      record.user.status !== "ACTIVE"
    ) {
      await db.session.deleteMany({ where: { id: record.id } });
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      user: toAuthUser(record.user),
    };
  } catch {
    return null;
  }
}

export const getCurrentSession = cache(readCurrentSession);

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  return session?.user ?? null;
});

export const createUserSession = createSession;
