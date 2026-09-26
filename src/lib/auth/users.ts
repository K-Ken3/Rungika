import "server-only";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/validation/auth";

export async function createAuthUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  return db.user.create({
    data: {
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: null,
    },
    select: {
      id: true,
      status: true,
      email: true,
      emailVerifiedAt: true,
    },
  });
}

export async function findUserForAuthentication(email: string) {
  return db.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      emailVerifiedAt: true,
    },
  });
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
