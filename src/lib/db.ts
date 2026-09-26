import "server-only";

import { PrismaClient } from "@prisma/client";
import { isProduction } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  rungikaPrisma?: PrismaClient;
};

export const db = globalForPrisma.rungikaPrisma ?? new PrismaClient();

if (!isProduction()) {
  globalForPrisma.rungikaPrisma = db;
}

export default db;
