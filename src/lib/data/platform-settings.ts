import "server-only";

import { BillingInterval, Prisma } from "@prisma/client";
import { toMinorUnits } from "@/lib/billing";
import { db } from "@/lib/db";
import { ActiveAdmin, requireAdminRole } from "@/lib/data/admin";

export interface PlatformSettingsDTO {
  id: string;
  planName: string;
  priceMinor: number;
  currency: string;
  paymentCurrency: string;
  billingInterval: BillingInterval;
  trialDays: number;
  gracePeriodDays: number;
  claimReviewDays: number;
  reminderDays: number[];
  momoProvider: string | null;
  momoRecipientName: string | null;
  momoMerchantCode: string | null;
  momoCountry: string | null;
  momoQrKeyConfigured: boolean;
  paymentInstructions: string | null;
  supportContact: string | null;
  allowMultipleBusinesses: boolean;
  maxBusinessesPerOwner: number;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  referenceFormat: string;
  updatedAt: string;
}

export interface UpdatePlatformSettingsInput {
  planName: string;
  priceMajor: number;
  currency: string;
  paymentCurrency: string;
  billingInterval: BillingInterval;
  trialDays: number;
  gracePeriodDays: number;
  claimReviewDays: number;
  reminderDays: number[];
  momoProvider: string | null;
  momoRecipientName: string | null;
  momoMerchantCode: string | null;
  momoCountry: string | null;
  momoQrKey?: string;
  paymentInstructions: string | null;
  supportContact: string | null;
  allowMultipleBusinesses: boolean;
  maxBusinessesPerOwner: number;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  referenceFormat: string;
}

function boundedInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a whole number between ${minimum} and ${maximum}`);
  }
  return value;
}

function boundedText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  if (normalized.length > maximum) {
    throw new Error(`${label} is too long`);
  }
  return normalized;
}

function optionalText(value: string | null, label: string, maximum: number): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new Error(`${label} is too long`);
  }
  return normalized || null;
}

function currencyCode(value: string, label: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`${label} must be a three-letter currency code`);
  }
  return normalized;
}

function validateSettings(input: UpdatePlatformSettingsInput) {
  const planName = boundedText(input.planName, "Plan name", 80);
  const priceMinor = toMinorUnits(input.priceMajor);
  if (priceMinor < 1 || priceMinor > 100_000_000) {
    throw new Error("Price must be greater than zero and no more than 1,000,000");
  }
  const currency = currencyCode(input.currency, "Currency");
  const paymentCurrency = currencyCode(input.paymentCurrency, "Payment currency");
  if (currency !== paymentCurrency) {
    throw new Error("Payment currency must match currency because no separate fixed local amount is configured");
  }
  if (![BillingInterval.MONTH, BillingInterval.QUARTER, BillingInterval.YEAR].includes(input.billingInterval)) {
    throw new Error("Billing interval is invalid");
  }
  const trialDays = boundedInteger(input.trialDays, "Trial days", 0, 365);
  const gracePeriodDays = boundedInteger(input.gracePeriodDays, "Grace period days", 0, 365);
  const claimReviewDays = boundedInteger(input.claimReviewDays, "Claim review days", 0, 365);
  const reminderDays = [...new Set(input.reminderDays)].sort((a, b) => b - a);
  for (const day of reminderDays) {
    boundedInteger(day, "Reminder days", 0, 365);
  }
  const maxBusinessesPerOwner = boundedInteger(input.maxBusinessesPerOwner, "Maximum businesses per owner", 1, 1000);
  if (!input.allowMultipleBusinesses && maxBusinessesPerOwner !== 1) {
    throw new Error("Maximum businesses per owner must be 1 when multiple businesses are disabled");
  }
  const referenceFormat = boundedText(input.referenceFormat, "Reference format", 200);
  return {
    planName,
    priceMinor,
    currency,
    paymentCurrency,
    billingInterval: input.billingInterval,
    trialDays,
    gracePeriodDays,
    claimReviewDays,
    reminderDays,
    momoProvider: optionalText(input.momoProvider, "MoMo provider", 100),
    momoRecipientName: optionalText(input.momoRecipientName, "MoMo recipient name", 160),
    momoMerchantCode: optionalText(input.momoMerchantCode, "MoMo merchant code", 100),
    momoCountry: optionalText(input.momoCountry, "MoMo country", 100),
    momoQrKey: input.momoQrKey?.trim() || undefined,
    paymentInstructions: optionalText(input.paymentInstructions, "Payment instructions", 2000),
    supportContact: optionalText(input.supportContact, "Support contact", 320),
    allowMultipleBusinesses: input.allowMultipleBusinesses,
    maxBusinessesPerOwner,
    emailNotificationsEnabled: input.emailNotificationsEnabled,
    smsNotificationsEnabled: input.smsNotificationsEnabled,
    referenceFormat,
  };
}

export async function getPlatformSettings(admin: ActiveAdmin): Promise<PlatformSettingsDTO> {
  const setting = await db.platformSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      createdById: admin.userId,
      updatedById: admin.userId,
    },
    update: {},
    select: {
      id: true,
      planName: true,
      priceMinor: true,
      currency: true,
      paymentCurrency: true,
      billingInterval: true,
      trialDays: true,
      gracePeriodDays: true,
      claimReviewDays: true,
      reminderDays: true,
      momoProvider: true,
      momoRecipientName: true,
      momoMerchantCode: true,
      momoCountry: true,
      momoQrKey: true,
      paymentInstructions: true,
      supportContact: true,
      allowMultipleBusinesses: true,
      maxBusinessesPerOwner: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      referenceFormat: true,
      updatedAt: true,
    },
  });

  return {
    id: setting.id,
    planName: setting.planName,
    priceMinor: setting.priceMinor,
    currency: setting.currency,
    paymentCurrency: setting.paymentCurrency,
    billingInterval: setting.billingInterval,
    trialDays: setting.trialDays,
    gracePeriodDays: setting.gracePeriodDays,
    claimReviewDays: setting.claimReviewDays,
    reminderDays: setting.reminderDays,
    momoProvider: setting.momoProvider,
    momoRecipientName: setting.momoRecipientName,
    momoMerchantCode: setting.momoMerchantCode,
    momoCountry: setting.momoCountry,
    momoQrKeyConfigured: Boolean(setting.momoQrKey),
    paymentInstructions: setting.paymentInstructions,
    supportContact: setting.supportContact,
    allowMultipleBusinesses: setting.allowMultipleBusinesses,
    maxBusinessesPerOwner: setting.maxBusinessesPerOwner,
    emailNotificationsEnabled: setting.emailNotificationsEnabled,
    smsNotificationsEnabled: setting.smsNotificationsEnabled,
    referenceFormat: setting.referenceFormat,
    updatedAt: setting.updatedAt.toISOString(),
  };
}

export async function updatePlatformSettings(
  admin: ActiveAdmin,
  input: UpdatePlatformSettingsInput,
): Promise<PlatformSettingsDTO> {
  requireAdminRole(admin, ["SUPER_ADMIN"]);
  const values = validateSettings(input);

  await db.$transaction(async (tx) => {
    const before = await tx.platformSetting.findUnique({ where: { id: "default" } });
    await tx.platformSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        planName: values.planName,
        priceMinor: values.priceMinor,
        currency: values.currency,
        billingInterval: values.billingInterval,
        trialDays: values.trialDays,
        gracePeriodDays: values.gracePeriodDays,
        claimReviewDays: values.claimReviewDays,
        reminderDays: values.reminderDays,
        momoProvider: values.momoProvider,
        momoRecipientName: values.momoRecipientName,
        momoMerchantCode: values.momoMerchantCode,
        momoCountry: values.momoCountry,
        momoQrKey: values.momoQrKey,
        paymentInstructions: values.paymentInstructions,
        supportContact: values.supportContact,
        allowMultipleBusinesses: values.allowMultipleBusinesses,
        maxBusinessesPerOwner: values.maxBusinessesPerOwner,
        emailNotificationsEnabled: values.emailNotificationsEnabled,
        smsNotificationsEnabled: values.smsNotificationsEnabled,
        paymentCurrency: values.paymentCurrency,
        referenceFormat: values.referenceFormat,
        createdById: admin.userId,
        updatedById: admin.userId,
      },
      update: {
        planName: values.planName,
        priceMinor: values.priceMinor,
        currency: values.currency,
        billingInterval: values.billingInterval,
        trialDays: values.trialDays,
        gracePeriodDays: values.gracePeriodDays,
        claimReviewDays: values.claimReviewDays,
        reminderDays: values.reminderDays,
        momoProvider: values.momoProvider,
        momoRecipientName: values.momoRecipientName,
        momoMerchantCode: values.momoMerchantCode,
        momoCountry: values.momoCountry,
        ...(values.momoQrKey ? { momoQrKey: values.momoQrKey } : {}),
        paymentInstructions: values.paymentInstructions,
        supportContact: values.supportContact,
        allowMultipleBusinesses: values.allowMultipleBusinesses,
        maxBusinessesPerOwner: values.maxBusinessesPerOwner,
        emailNotificationsEnabled: values.emailNotificationsEnabled,
        smsNotificationsEnabled: values.smsNotificationsEnabled,
        paymentCurrency: values.paymentCurrency,
        referenceFormat: values.referenceFormat,
        updatedById: admin.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "PLATFORM_SETTINGS.UPDATED",
        entityType: "PlatformSetting",
        entityId: "default",
        metadata: {
          changed: before ? ["PLATFORM_SETTINGS.UPDATED"] : ["PLATFORM_SETTINGS.CREATED"],
          planName: values.planName,
          priceMinor: values.priceMinor,
          currency: values.currency,
          paymentCurrency: values.paymentCurrency,
          billingInterval: values.billingInterval,
          allowMultipleBusinesses: values.allowMultipleBusinesses,
          emailNotificationsEnabled: values.emailNotificationsEnabled,
          smsNotificationsEnabled: values.smsNotificationsEnabled,
        },
      },
    });
  });

  return getPlatformSettings(admin);
}

export type PlatformSettingUpdateData = Prisma.PlatformSettingUpdateInput;
