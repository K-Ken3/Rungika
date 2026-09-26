import "server-only";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  hasPermissionKey,
  type BusinessPermissionKey,
} from "@/lib/permissions";
import { getCurrentUser, getCurrentSession } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";

function signInPath(callbackUrl?: string) {
  if (
    callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//")
  ) {
    return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  return "/sign-in";
}

export async function requireUser(callbackUrl?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(signInPath(callbackUrl));
  }
  if (!user.emailVerifiedAt) {
    redirect("/sign-in?verify=required");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!user.adminMembership?.active) {
    redirect(user.memberships.length > 0 ? "/business" : "/onboarding");
  }
  return user;
}

export async function getBusinessPermissionKeys(
  userId: string,
  businessId: string,
): Promise<string[]> {
  if (!userId || !businessId) {
    return [];
  }

  const membership = await db.businessMembership.findFirst({
    where: {
      userId,
      businessId,
      status: "ACTIVE",
    },
    select: {
      role: {
        select: {
          permissions: {
            select: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return [];
  }

  return membership.role.permissions.map(
    (rolePermission: { permission: { key: string } }) => rolePermission.permission.key,
  );
}

export async function hasBusinessPermission(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  const databasePermissionKeys = await getBusinessPermissionKeys(userId, businessId);
  return hasPermissionKey(databasePermissionKeys, permission);
}

export async function requireBusinessPermission(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  if (!(await hasBusinessPermission(userId, businessId, permission))) {
    redirect("/business");
  }
}

export async function requireCurrentUserPermission(
  businessId: string,
  permission: BusinessPermissionKey,
) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/sign-in");
  }
  await requireBusinessPermission(session.userId, businessId, permission);
  return session.user;
}
