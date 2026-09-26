import "server-only";

import { db } from "@/lib/db";
import type { AuthRedirectPath } from "@/lib/auth/types";

export async function getPostSignInPath(userId: string): Promise<AuthRedirectPath> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      emailVerifiedAt: true,
      adminMembership: {
        select: { active: true },
      },
      memberships: {
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
    return "/onboarding";
  }
  if (user.adminMembership?.active) {
    return "/super-admin";
  }
  if (user.memberships.length > 0) {
    return "/business";
  }
  return "/onboarding";
}
