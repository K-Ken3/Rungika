import "server-only";

import bcrypt from "bcryptjs";

export const PASSWORD_HASH_COST = 12;

const DUMMY_PASSWORD_HASH =
  "$2b$12$X3AouEmLI95X.GW6Cpn6QuKZSDph0hzt5Uj9hLcVTXH.pHqRt/67i";

export async function hashPassword(password: string) {
  if (new TextEncoder().encode(password).byteLength > 72) {
    throw new Error("Password is too long");
  }
  return bcrypt.hash(password, PASSWORD_HASH_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
) {
  if (new TextEncoder().encode(password).byteLength > 72) {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash ?? DUMMY_PASSWORD_HASH);
  } catch {
    return false;
  }
}
