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

async function ensureSuperAdmin(): Promise<void> {
  const email = envValue("SUPER_ADMIN_EMAIL");
  const password = envValue("SUPER_ADMIN_PASSWORD");
  const name = envValue("SUPER_ADMIN_NAME") ?? "Platform Owner";

  if (!email || !password) {
    return;
  }

  const normalizedEmail = email.toLowerCase();
  if (new TextEncoder().encode(password).byteLength > 72 || password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerifiedAt: true },
  });
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          passwordHash: await bcrypt.hash(password, 12),
          status: "ACTIVE",
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash: await bcrypt.hash(password, 12),
          emailVerifiedAt: new Date(),
        },
      });

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

  if (!envValue("SUPER_ADMIN_EMAIL") || !envValue("SUPER_ADMIN_PASSWORD")) {
    process.stdout.write(
      "Super Admin not created. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (minimum 12 characters) and rerun this seed.\n",
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
