import { PrismaClient, type PermissionAction } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  BUSINESS_PERMISSION_DEFINITIONS,
  type BusinessPermissionKey,
} from "../src/lib/permissions";
import { DEFAULT_SUBSCRIPTION_PLAN, DEFAULT_TRIAL_DAYS } from "../src/lib/billing";

const prisma = new PrismaClient();

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function syncPermissionCatalog(): Promise<void> {
  const keys = Object.keys(BUSINESS_PERMISSION_DEFINITIONS) as BusinessPermissionKey[];
  for (const key of keys) {
    const definition = BUSINESS_PERMISSION_DEFINITIONS[key];
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        module: definition.module,
        action: definition.action as PermissionAction,
        description: definition.description,
      },
      update: {
        module: definition.module,
        action: definition.action as PermissionAction,
        description: definition.description,
      },
    });
  }

  const staleKeys = await prisma.permission.findMany({
    where: { key: { notIn: keys } },
    select: { key: true },
  });
  if (staleKeys.length > 0) {
    process.stdout.write(
      `Kept ${staleKeys.length} custom permission(s) outside the built-in catalog: ${staleKeys
        .map((entry) => entry.key)
        .join(", ")}\n`,
    );
  }
}

async function ensurePlatformSettings(): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      planName: DEFAULT_SUBSCRIPTION_PLAN.planName,
      priceMinor: DEFAULT_SUBSCRIPTION_PLAN.amountMinor,
      currency: DEFAULT_SUBSCRIPTION_PLAN.currency,
      billingInterval: DEFAULT_SUBSCRIPTION_PLAN.interval,
      trialDays: DEFAULT_TRIAL_DAYS,
    },
    update: {},
  });

  await prisma.plan.upsert({
    where: { id: "default-business" },
    create: {
      id: "default-business",
      name: DEFAULT_SUBSCRIPTION_PLAN.planName,
      amountMinor: DEFAULT_SUBSCRIPTION_PLAN.amountMinor,
      currency: DEFAULT_SUBSCRIPTION_PLAN.currency,
      interval: DEFAULT_SUBSCRIPTION_PLAN.interval,
      active: true,
    },
    update: {
      name: DEFAULT_SUBSCRIPTION_PLAN.planName,
      amountMinor: DEFAULT_SUBSCRIPTION_PLAN.amountMinor,
      currency: DEFAULT_SUBSCRIPTION_PLAN.currency,
      interval: DEFAULT_SUBSCRIPTION_PLAN.interval,
    },
  });
}

async function createPasswordHash(password: string): Promise<string> {
  if (new TextEncoder().encode(password).byteLength > 72 || password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters");
  }
  return bcrypt.hash(password, 12);
}

async function ensureSuperAdmin(): Promise<void> {
  const email = envValue("SUPER_ADMIN_EMAIL");
  const password = envValue("SUPER_ADMIN_PASSWORD");
  const name = envValue("SUPER_ADMIN_NAME") ?? "Platform Owner";

  if (!email) {
    return;
  }

  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerifiedAt: true },
  });

  if (!existingUser && !password) {
    process.stdout.write(
      `Super Admin ${normalizedEmail} does not exist. Set SUPER_ADMIN_PASSWORD to create the account.\n`,
    );
    return;
  }

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          status: "ACTIVE",
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash: await createPasswordHash(password as string),
          emailVerifiedAt: new Date(),
        },
      });

  if (existingUser) {
    process.stdout.write(
      `Super Admin ${normalizedEmail} already exists. Existing password preserved.\n`,
    );
  }

  await prisma.adminMembership.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: "SUPER_ADMIN", active: true },
    update: { role: "SUPER_ADMIN", active: true },
  });
}

async function main(): Promise<void> {
  await syncPermissionCatalog();
  await ensurePlatformSettings();
  await ensureSuperAdmin();

  const permissionCount = await prisma.permission.count();
  process.stdout.write(`Permissions synchronized: ${permissionCount}\n`);

  if (!envValue("SUPER_ADMIN_EMAIL")) {
    process.stdout.write(
      "Super Admin skipped. Set SUPER_ADMIN_EMAIL to create or repair the admin account.\n",
    );
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
