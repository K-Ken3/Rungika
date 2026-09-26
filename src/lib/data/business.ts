import "server-only";

import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { redirect } from "next/navigation";
import {
  BusinessStatus,
  FieldType,
  PermissionAction,
  Prisma,
  SupportCaseStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  DEFAULT_TRIAL_DAYS,
  calculateBillingDates,
  type BillingInterval,
} from "@/lib/billing";
import { hasBusinessPermission } from "@/lib/auth/authorization";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TOKEN_TTL_DAYS,
  sendInvitationEmail,
} from "@/lib/auth/invitations";
import {
  BUSINESS_PERMISSION_DEFINITIONS,
  BUSINESS_PERMISSION_KEYS,
  type BusinessPermissionKey,
  type MembershipRole,
  permissionsForRole,
} from "@/lib/permissions";
import { hasPaidOperationalAccess } from "@/components/business/rules";

const BUSINESS_CREATION_MAX_WAIT_MS = 20_000;
const BUSINESS_CREATION_TIMEOUT_MS = 60_000;

const DEFAULT_PLATFORM_SETTINGS = {
  planName: "Business",
  priceMinor: 300,
  currency: "USD",
  billingInterval: "MONTH" as BillingInterval,
  trialDays: DEFAULT_TRIAL_DAYS,
  gracePeriodDays: 3,
  claimReviewDays: 5,
  paymentCurrency: "USD",
  referenceFormat: "RUNGIKA-{BUSINESS}-{DUE_DATE}",
  allowMultipleBusinesses: true,
  maxBusinessesPerOwner: 5,
  supportContact: null,
  momoRecipientName: null,
  momoMerchantCode: null,
  momoCountry: null,
  momoProvider: null,
  paymentInstructions: null,
};

export class BusinessAccessError extends Error {}
export class BusinessRestrictionError extends Error {}
export class BusinessValidationError extends Error {}
export class BusinessConflictError extends Error {}

export type BusinessStatusValue = BusinessStatus;

export interface BusinessAccessDTO {
  membershipId: string;
  userId: string;
  businessId: string;
  role: MembershipRole;
  business: {
    id: string;
    name: string;
    slug: string;
    status: BusinessStatus;
    category: string | null;
    description: string | null;
    country: string;
    location: string | null;
    phone: string | null;
    email: string | null;
    logoKey: string | null;
    timezone: string;
    currency: string;
    adminHold: boolean;
    pauseReason: string | null;
  };
  subscription: {
    id: string;
    planNameSnapshot: string;
    amountMinor: number;
    currency: string;
    interval: BillingInterval;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    dueDate: string;
    graceEndsAt: string | null;
  } | null;
  hasPaidAccess: boolean;
}

export interface BusinessSelectorItem {
  membershipId: string;
  businessId: string;
  name: string;
  slug: string;
  status: BusinessStatus;
  role: MembershipRole;
  subscriptionStatus: string | null;
}

export interface PlatformSettingsDTO {
  planName: string;
  priceMinor: number;
  currency: string;
  billingInterval: BillingInterval;
  trialDays: number;
  gracePeriodDays: number;
  claimReviewDays: number;
  paymentCurrency: string;
  referenceFormat: string;
  allowMultipleBusinesses: boolean;
  maxBusinessesPerOwner: number;
  supportContact: string | null;
  momoRecipientName: string | null;
  momoMerchantCode: string | null;
  momoCountry: string | null;
  momoProvider: string | null;
  paymentInstructions: string | null;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapRole(value: string): MembershipRole {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (
    normalized === "OWNER" ||
    normalized === "MANAGER" ||
    normalized === "EMPLOYEE" ||
    normalized === "READ_ONLY"
  ) {
    return normalized;
  }
  return "READ_ONLY";
}

function slugify(value: string) {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `business-${randomUUID().slice(0, 8)}`;
}

function paymentReference(format: string, businessSlug: string, dueDate: Date) {
  return format
    .replaceAll("{BUSINESS}", businessSlug.toUpperCase())
    .replaceAll("{DUE_DATE}", dueDate.toISOString().slice(0, 10).replaceAll("-", ""))
    .slice(0, 120);
}

type BusinessAccessSource = Prisma.BusinessMembershipGetPayload<{
  include: {
    role: true;
    business: { include: { subscription: true } };
  };
}>;

function mapAccess(
  value: BusinessAccessSource,
  initialNotification: { data: Prisma.JsonValue } | null,
): BusinessAccessDTO {
  const subscription = value.business.subscription;
  const notificationData =
    initialNotification &&
    typeof initialNotification.data === "object" &&
    initialNotification.data !== null &&
    !Array.isArray(initialNotification.data)
      ? (initialNotification.data as Record<string, unknown>)
      : null;
  const configuredTrialDays = notificationData?.trialDays;
  const trialDays =
    typeof configuredTrialDays === "number" &&
    Number.isInteger(configuredTrialDays) &&
    configuredTrialDays >= 0
      ? configuredTrialDays
      : 0;
  return {
    membershipId: value.id,
    userId: value.userId,
    businessId: value.businessId,
    role: mapRole(value.role.name),
    business: {
      id: value.business.id,
      name: value.business.name,
      slug: value.business.slug,
      status: value.business.status,
      category: value.business.category,
      description: value.business.description,
      country: value.business.country,
      location: value.business.location,
      phone: value.business.phone,
      email: value.business.email,
      logoKey: value.business.logoKey,
      timezone: value.business.timezone,
      currency: value.business.currency,
      adminHold: value.business.adminHold,
      pauseReason: value.business.pauseReason,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          planNameSnapshot: subscription.planNameSnapshot,
          amountMinor: subscription.amountMinor,
          currency: subscription.currency,
          interval: subscription.interval,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          dueDate: subscription.dueDate.toISOString(),
          graceEndsAt: toIso(subscription.graceEndsAt),
        }
      : null,
    hasPaidAccess: hasPaidOperationalAccess({
      businessStatus: value.business.status,
      subscriptionStatus: subscription?.status ?? "PENDING_PAYMENT",
      trialDays,
      trialEndsAt: subscription?.currentPeriodEnd.toISOString() ?? null,
    }),
  };
}

async function loadBusinessAccess(userId: string, businessId: string) {
  if (!userId || !businessId) {
    return null;
  }
  const [membership, initialNotification] = await Promise.all([
    db.businessMembership.findFirst({
      where: { userId, businessId, status: "ACTIVE" },
      include: {
        role: true,
        business: { include: { subscription: true } },
      },
    }),
    db.notification.findFirst({
      where: {
        userId,
        businessId,
        type: "PAYMENT_DUE",
      },
      orderBy: { createdAt: "asc" },
      select: { data: true },
    }),
  ]);
  return membership ? mapAccess(membership, initialNotification) : null;
}

export async function getBusinessAccess(userId: string, businessId: string) {
  const access = await loadBusinessAccess(userId, businessId);
  if (!access) {
    throw new BusinessAccessError("An active business membership is required.");
  }
  return access;
}

export async function requireBusinessMembership(userId: string, businessId: string) {
  const access = await getBusinessAccess(userId, businessId).catch(() => null);
  if (!access) {
    redirect("/business");
  }
  return access;
}

export async function assertBusinessPermission(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  await getBusinessAccess(userId, businessId);
  if (!(await hasBusinessPermission(userId, businessId, permission))) {
    throw new BusinessAccessError("You do not have permission to perform this action.");
  }
}

export async function assertOperationalBusinessAccess(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  const access = await getBusinessAccess(userId, businessId);
  if (!(await hasBusinessPermission(userId, businessId, permission))) {
    throw new BusinessAccessError("You do not have permission to perform this action.");
  }
  if (access.business.adminHold || !access.hasPaidAccess) {
    throw new BusinessRestrictionError(
      "Complete billing to use operational business features.",
    );
  }
  return access;
}

export async function requireAccessibleBusiness(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  const access = await getBusinessAccess(userId, businessId).catch(() => null);
  if (!access) {
    redirect("/business");
  }
  if (!(await hasBusinessPermission(userId, businessId, permission))) {
    redirect(`/business/${encodeURIComponent(businessId)}`);
  }
  return access;
}

export async function requireOperationalBusinessAccess(
  userId: string,
  businessId: string,
  permission: BusinessPermissionKey,
) {
  const access = await requireAccessibleBusiness(userId, businessId, permission);
  if (access.business.adminHold || !access.hasPaidAccess) {
    redirect(`/business/${encodeURIComponent(businessId)}/restricted`);
  }
  return access;
}

export async function getBusinessSelector(userId: string): Promise<BusinessSelectorItem[]> {
  if (!userId) {
    return [];
  }
  const memberships = await db.businessMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { business: { include: { subscription: true } }, role: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((membership) => ({
    membershipId: membership.id,
    businessId: membership.businessId,
    name: membership.business.name,
    slug: membership.business.slug,
    status: membership.business.status,
    role: mapRole(membership.role.name),
    subscriptionStatus: membership.business.subscription?.status ?? null,
  }));
}

async function getPlatformSettings(): Promise<PlatformSettingsDTO> {
  const setting = await db.platformSetting.findUnique({ where: { id: "default" } });
  if (!setting) {
    return DEFAULT_PLATFORM_SETTINGS;
  }
  return {
    planName: setting.planName,
    priceMinor: setting.priceMinor,
    currency: setting.currency.toUpperCase(),
    billingInterval: setting.billingInterval,
    trialDays: setting.trialDays,
    gracePeriodDays: setting.gracePeriodDays,
    claimReviewDays: setting.claimReviewDays,
    paymentCurrency: setting.paymentCurrency.toUpperCase(),
    referenceFormat: setting.referenceFormat,
    allowMultipleBusinesses: setting.allowMultipleBusinesses,
    maxBusinessesPerOwner: setting.maxBusinessesPerOwner,
    supportContact: setting.supportContact,
    momoRecipientName: setting.momoRecipientName,
    momoMerchantCode: setting.momoMerchantCode,
    momoCountry: setting.momoCountry,
    momoProvider: setting.momoProvider,
    paymentInstructions: setting.paymentInstructions,
  };
}

export interface CreateBusinessInput {
  userId: string;
  name: string;
  slug?: string;
  category?: string;
  description?: string;
  country: string;
  location?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  currency?: string;
}

export interface CreateBusinessResult {
  businessId: string;
  slug: string;
  trialDays: number;
  amountMinor: number;
  currency: string;
  paymentCurrency: string;
  dueDate: string;
  paymentReference: string;
  paymentInstructions: string | null;
}

export async function createBusinessWithDefaults(
  input: CreateBusinessInput,
): Promise<CreateBusinessResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new BusinessValidationError("Business name must contain 2 to 120 characters.");
  }
  if (!Number.isInteger(input.country.length) || input.country.length !== 2) {
    throw new BusinessValidationError("Country must be a two-letter code.");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const user = await tx.user.findFirst({
            where: { id: input.userId, status: "ACTIVE" },
            select: { id: true },
          });
          if (!user) {
            throw new BusinessAccessError("An active account is required.");
          }
          const setting = await tx.platformSetting.findUnique({ where: { id: "default" } });
          const ownerCount = await tx.businessMembership.count({
            where: {
              userId: input.userId,
              status: "ACTIVE",
              role: { name: "Owner" },
            },
          });
          const allowMultiple = setting?.allowMultipleBusinesses ?? true;
          const maximum = setting?.maxBusinessesPerOwner ?? 5;
          if ((!allowMultiple && ownerCount > 0) || ownerCount >= maximum) {
            throw new BusinessConflictError(
              `Your account has reached the configured limit of ${maximum} businesses.`,
            );
          }
          if ((setting?.priceMinor ?? 300) < 1) {
            throw new BusinessValidationError("The configured plan price is invalid.");
          }
          if ((setting?.trialDays ?? 0) < 0) {
            throw new BusinessValidationError("The configured trial period is invalid.");
          }

          const baseSlug = slugify(input.slug || name);
          let slug = baseSlug;
          for (let suffix = 2; await tx.business.findUnique({ where: { slug } }); suffix += 1) {
            slug = `${baseSlug}-${suffix}`.slice(0, 64);
          }

          const now = new Date();
          const trialDays = setting?.trialDays ?? 0;
          const cycle = calculateBillingDates(
            now,
            setting?.billingInterval ?? "MONTH",
          );
          const dueDate = trialDays > 0 ? addDays(now, trialDays) : cycle.dueDate;
          const periodEnd = trialDays > 0 ? dueDate : cycle.periodEnd;
          const amountMinor = setting?.priceMinor ?? 300;
          const currency = (setting?.currency ?? "USD").toUpperCase();
          const paymentCurrency = (setting?.paymentCurrency ?? currency).toUpperCase();
          const referenceFormat = setting?.referenceFormat ?? "RUNGIKA-{BUSINESS}-{DUE_DATE}";
          const businessReference = paymentReference(referenceFormat, slug, dueDate);
          const business = await tx.business.create({
            data: {
              name,
              slug,
              category: input.category?.trim() || null,
              description: input.description?.trim() || null,
              country: input.country.trim().toUpperCase(),
              location: input.location?.trim() || null,
              phone: input.phone?.trim() || null,
              email: input.email?.trim().toLowerCase() || null,
              timezone: input.timezone?.trim() || "UTC",
              currency,
              status: "PENDING_PAYMENT",
              createdById: input.userId,
            },
          });

          await tx.permission.createMany({
            data: BUSINESS_PERMISSION_KEYS.map((key) => ({
              key,
              module: BUSINESS_PERMISSION_DEFINITIONS[key].module,
              action: BUSINESS_PERMISSION_DEFINITIONS[key].action as PermissionAction,
              description: BUSINESS_PERMISSION_DEFINITIONS[key].description,
            })),
            skipDuplicates: true,
          });
          const permissions = await tx.permission.findMany({
            where: { key: { in: [...BUSINESS_PERMISSION_KEYS] } },
            select: { id: true, key: true },
          });
          const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
          const defaultRoles = [
            { name: "Owner", description: "Full business access", keys: [...BUSINESS_PERMISSION_KEYS] },
            { name: "Manager", description: "Manages daily operations", keys: [...permissionsForRole("MANAGER")] },
            { name: "Employee", description: "Creates and edits operational data", keys: [...permissionsForRole("EMPLOYEE")] },
            { name: "Read-only", description: "Views business data", keys: [...permissionsForRole("READ_ONLY")] },
          ];
          const roles = [];
          for (const definition of defaultRoles) {
            const role = await tx.role.create({
              data: {
                businessId: business.id,
                name: definition.name,
                description: definition.description,
                isSystem: true,
              },
            });
            roles.push(role);
            await tx.rolePermission.createMany({
              data: definition.keys.flatMap((key) => {
                const permissionId = permissionByKey.get(key);
                return permissionId ? [{ roleId: role.id, permissionId }] : [];
              }),
              skipDuplicates: true,
            });
          }
          const ownerRole = roles[0];
          const membership = await tx.businessMembership.create({
            data: {
              businessId: business.id,
              userId: input.userId,
              roleId: ownerRole.id,
              status: "ACTIVE",
            },
          });
          const subscription = await tx.subscription.create({
            data: {
              businessId: business.id,
              planId: null,
              planNameSnapshot: setting?.planName ?? "Business",
              amountMinor,
              currency,
              interval: setting?.billingInterval ?? "MONTH",
              status: "PENDING_PAYMENT",
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              dueDate,
            },
          });
          const invoice = await tx.invoice.create({
            data: {
              businessId: business.id,
              subscriptionId: subscription.id,
              number: `INV-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
              amountMinor,
              currency,
              periodStart: now,
              periodEnd,
              dueDate,
              status: "OPEN",
            },
          });
          await tx.subscriptionStatusHistory.create({
            data: {
              subscriptionId: subscription.id,
              toStatus: "PENDING_PAYMENT",
              reason:
                trialDays > 0
                  ? `${trialDays}-day trial started; initial invoice remains open.`
                  : "Business created; initial payment is required.",
              changedById: input.userId,
            },
          });
          await tx.notification.create({
            data: {
              userId: input.userId,
              businessId: business.id,
              type: "PAYMENT_DUE",
              title: trialDays > 0 ? "Trial started" : "Payment required",
              message:
                trialDays > 0
                  ? `Your ${trialDays}-day trial is active. Invoice ${invoice.number} remains open and is due ${dueDate.toISOString()}.`
                  : `Your business is pending payment. Invoice ${invoice.number} is due ${dueDate.toISOString()}.`,
              data: {
                kind: "INITIAL_PAYMENT_DUE",
                invoiceId: invoice.id,
                amountMinor,
                currency,
                paymentCurrency,
                reference: businessReference,
                trialDays,
              },
            },
          });
          await tx.auditLog.create({
            data: {
              businessId: business.id,
              actorId: input.userId,
              action: "BUSINESS.CREATED",
              entityType: "Business",
              entityId: business.id,
              metadata: {
                membershipId: membership.id,
                subscriptionId: subscription.id,
                invoiceId: invoice.id,
                trialDays,
                amountMinor,
                currency,
                interval: setting?.billingInterval ?? "MONTH",
              },
            },
          });
          return {
            businessId: business.id,
            slug,
            trialDays,
            amountMinor,
            currency,
            paymentCurrency,
            dueDate: dueDate.toISOString(),
            paymentReference: businessReference,
            paymentInstructions: setting?.paymentInstructions ?? null,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: BUSINESS_CREATION_MAX_WAIT_MS,
          timeout: BUSINESS_CREATION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }
  throw lastError;
}

export interface BusinessSettingsDTO {
  business: BusinessAccessDTO["business"];
  settings: PlatformSettingsDTO;
}

export async function getBusinessSettings(
  userId: string,
  businessId: string,
): Promise<BusinessSettingsDTO> {
  const access = await requireAccessibleBusiness(userId, businessId, "settings.view");
  return { business: access.business, settings: await getPlatformSettings() };
}

export interface BusinessDashboardDTO {
  business: BusinessAccessDTO["business"];
  subscription: BusinessAccessDTO["subscription"];
  metrics: {
    activeMembers: number;
    units: number;
    customTables: number;
    records: number;
    openInvoices: number;
    unreadNotifications: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actorName: string | null;
  }>;
}

export async function getBusinessDashboard(
  userId: string,
  businessId: string,
): Promise<BusinessDashboardDTO> {
  await requireOperationalBusinessAccess(userId, businessId, "dashboard.view");
  const [activeMembers, units, customTables, records, openInvoices, unreadNotifications, recentActivity] =
    await Promise.all([
      db.businessMembership.count({ where: { businessId, status: "ACTIVE" } }),
      db.businessUnit.count({ where: { businessId } }),
      db.customTable.count({ where: { businessId } }),
      db.customRecord.count({ where: { businessId, status: "ACTIVE" } }),
      db.invoice.count({ where: { businessId, status: { in: ["OPEN", "OVERDUE"] } } }),
      db.notification.count({ where: { userId, businessId, readAt: null } }),
      db.auditLog.findMany({
        where: { businessId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);
  const access = await getBusinessAccess(userId, businessId);
  return {
    business: access.business,
    subscription: access.subscription,
    metrics: { activeMembers, units, customTables, records, openInvoices, unreadNotifications },
    recentActivity: recentActivity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.actor?.name ?? null,
    })),
  };
}

export interface PersonListItemDTO {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  unitId: string | null;
  unitName: string | null;
  jobTitle: string | null;
  startDate: string | null;
  joinedAt: string;
}

export interface InvitationListItemDTO {
  id: string;
  email: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface PeopleDTO {
  people: PersonListItemDTO[];
  invitations: InvitationListItemDTO[];
  units: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
}

export async function getPeople(
  userId: string,
  businessId: string,
): Promise<PeopleDTO> {
  await requireOperationalBusinessAccess(userId, businessId, "people.view");
  const [memberships, invitations, units, roles] = await Promise.all([
    db.businessMembership.findMany({
      where: { businessId },
      include: { user: true, role: true, unit: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { businessId },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    db.businessUnit.findMany({ where: { businessId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ where: { businessId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    people: memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      status: membership.status,
      role: membership.role.name,
      unitId: membership.unitId,
      unitName: membership.unit?.name ?? null,
      jobTitle: membership.jobTitle,
      startDate: membership.startDate ? membership.startDate.toISOString() : null,
      joinedAt: membership.createdAt.toISOString(),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      phone: invitation.phone,
      roleId: invitation.roleId,
      roleName: invitation.role.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })),
    units,
    roles,
  };
}

export interface UnitDTO {
  id: string;
  name: string;
  type: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  memberCount: number;
  createdAt: string;
}

export async function getBusinessUnits(
  userId: string,
  businessId: string,
): Promise<{ units: UnitDTO[]; parents: Array<{ id: string; name: string }> }> {
  await requireOperationalBusinessAccess(userId, businessId, "units.view");
  const units = await db.businessUnit.findMany({
    where: { businessId },
    include: {
      parent: { select: { name: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });
  return {
    units: units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      description: unit.description,
      parentId: unit.parentId,
      parentName: unit.parent?.name ?? null,
      memberCount: unit._count.memberships,
      createdAt: unit.createdAt.toISOString(),
    })),
    parents: units.map((unit) => ({ id: unit.id, name: unit.name })),
  };
}

export interface RoleDTO {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  memberCount: number;
  invitationCount: number;
  permissions: string[];
}

export async function getBusinessRoles(
  userId: string,
  businessId: string,
): Promise<{ roles: RoleDTO[]; catalog: Array<{ key: BusinessPermissionKey; module: string; action: string; description: string }> }> {
  await requireOperationalBusinessAccess(userId, businessId, "people.manage_users");
  const roles = await db.role.findMany({
    where: { businessId },
    include: {
      permissions: { include: { permission: { select: { key: true } } } },
      _count: { select: { memberships: true, invitations: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      memberCount: role._count.memberships,
      invitationCount: role._count.invitations,
      permissions: role.permissions.map((entry) => entry.permission.key),
    })),
    catalog: BUSINESS_PERMISSION_KEYS.map((key) => ({
      key,
      ...BUSINESS_PERMISSION_DEFINITIONS[key],
    })),
  };
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export async function getBusinessNotifications(
  userId: string,
  businessId: string,
): Promise<NotificationDTO[]> {
  await requireAccessibleBusiness(userId, businessId, "notifications.view");
  const notifications = await db.notification.findMany({
    where: { userId, businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: toIso(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }));
}

export interface AuditListDTO {
  entries: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actorName: string | null;
  }>;
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export async function getBusinessAuditLog(
  userId: string,
  businessId: string,
  requestedPage = 1,
): Promise<AuditListDTO> {
  await requireOperationalBusinessAccess(userId, businessId, "settings.view");
  const pageSize = 40;
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where: { businessId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where: { businessId } }),
  ]);
  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.createdAt.toISOString(),
      actorName: entry.actor?.name ?? null,
    })),
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface SupportCaseDTO {
  id: string;
  subject: string;
  message: string;
  status: SupportCaseStatus;
  reporterName: string;
  createdAt: string;
  updatedAt: string;
}

export async function getBusinessSupportCases(
  userId: string,
  businessId: string,
): Promise<{ cases: SupportCaseDTO[]; contact: string | null }> {
  await requireAccessibleBusiness(userId, businessId, "support.view");
  const [cases, settings] = await Promise.all([
    db.supportCase.findMany({
      where: { businessId, reporterId: userId },
      include: { reporter: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    getPlatformSettings(),
  ]);
  return {
    cases: cases.map((supportCase) => ({
      id: supportCase.id,
      subject: supportCase.subject,
      message: supportCase.message,
      status: supportCase.status,
      reporterName: supportCase.reporter.name,
      createdAt: supportCase.createdAt.toISOString(),
      updatedAt: supportCase.updatedAt.toISOString(),
    })),
    contact: settings.supportContact,
  };
}

export interface UpdateBusinessProfileInput {
  userId: string;
  businessId: string;
  name: string;
  category?: string;
  description?: string;
  country: string;
  location?: string;
  phone?: string;
  email?: string;
  timezone: string;
}

export async function updateBusinessProfile(input: UpdateBusinessProfileInput) {
  await assertBusinessPermission(input.userId, input.businessId, "business.edit");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new BusinessValidationError("Business name must contain 2 to 120 characters.");
  }
  return db.$transaction(async (tx) => {
    const business = await tx.business.update({
      where: { id: input.businessId },
      data: {
        name,
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        country: input.country.trim().toUpperCase(),
        location: input.location?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        timezone: input.timezone.trim() || "UTC",
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "BUSINESS.PROFILE_UPDATED",
        entityType: "Business",
        entityId: input.businessId,
      },
    });
    return business.id;
  });
}

export interface CreateUnitInput {
  userId: string;
  businessId: string;
  name: string;
  type: string;
  description?: string;
  parentId?: string;
}

export async function createBusinessUnit(input: CreateUnitInput) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "units.create");
  if (input.parentId) {
    const parent = await db.businessUnit.findFirst({
      where: { id: input.parentId, businessId: input.businessId },
      select: { id: true },
    });
    if (!parent) {
      throw new BusinessValidationError("The selected parent unit does not exist.");
    }
  }
  return db.businessUnit.create({
    data: {
      businessId: input.businessId,
      name: input.name.trim(),
      type: input.type.trim().toUpperCase(),
      description: input.description?.trim() || null,
      parentId: input.parentId || null,
      createdById: input.userId,
    },
  });
}

export interface UpdateUnitInput extends CreateUnitInput {
  unitId: string;
}

export async function updateBusinessUnit(input: UpdateUnitInput) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "units.edit");
  const unit = await db.businessUnit.findFirst({ where: { id: input.unitId, businessId: input.businessId } });
  if (!unit) {
    throw new BusinessValidationError("The unit does not exist.");
  }
  if (input.parentId === input.unitId) {
    throw new BusinessValidationError("A unit cannot be its own parent.");
  }
  if (input.parentId) {
    const parent = await db.businessUnit.findFirst({ where: { id: input.parentId, businessId: input.businessId } });
    if (!parent) {
      throw new BusinessValidationError("The selected parent unit does not exist.");
    }
  }
  return db.businessUnit.update({
    where: { id: input.unitId },
    data: {
      name: input.name.trim(),
      type: input.type.trim().toUpperCase(),
      description: input.description?.trim() || null,
      parentId: input.parentId || null,
    },
  });
}

export async function deleteBusinessUnit(input: {
  userId: string;
  businessId: string;
  unitId: string;
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "units.delete");
  const unit = await db.businessUnit.findFirst({
    where: { id: input.unitId, businessId: input.businessId },
    include: { _count: { select: { memberships: true, children: true } } },
  });
  if (!unit) {
    throw new BusinessValidationError("The unit does not exist.");
  }
  if (unit._count.memberships > 0 || unit._count.children > 0) {
    throw new BusinessConflictError("Move members and child units before deleting this unit.");
  }
  await db.businessUnit.delete({ where: { id: input.unitId } });
}

export interface InvitePersonInput {
  userId: string;
  businessId: string;
  email: string;
  phone?: string;
  roleId: string;
  unitId?: string;
}

export interface InvitePersonResult {
  invitationId: string;
  deliveryAvailable: boolean;
}

export async function invitePerson(input: InvitePersonInput): Promise<InvitePersonResult> {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "people.create");
  const [role, unit] = await Promise.all([
    db.role.findFirst({ where: { id: input.roleId, businessId: input.businessId }, select: { id: true } }),
    input.unitId
      ? db.businessUnit.findFirst({ where: { id: input.unitId, businessId: input.businessId }, select: { id: true } })
      : Promise.resolve({ id: null }),
  ]);
  if (!role) {
    throw new BusinessValidationError("The selected role does not exist.");
  }
  if (input.unitId && !unit) {
    throw new BusinessValidationError("The selected unit does not exist.");
  }
  const email = input.email.trim().toLowerCase();
  const token = generateInvitationToken();
  const invitation = await db.$transaction(async (tx) => {
    const existingMember = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existingMember) {
      const membership = await tx.businessMembership.findUnique({
        where: { businessId_userId: { businessId: input.businessId, userId: existingMember.id } },
      });
      if (membership) {
        throw new BusinessConflictError("This person is already a member of the business.");
      }
    }
    const created = await tx.invitation.create({
      data: {
        businessId: input.businessId,
        roleId: input.roleId,
        email,
        phone: input.phone?.trim() || null,
        tokenHash: hashInvitationToken(token),
        status: "INVITED",
        invitedById: input.userId,
        expiresAt: addDays(new Date(), INVITATION_TOKEN_TTL_DAYS),
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "PEOPLE.INVITED",
        entityType: "Invitation",
        entityId: created.id,
        metadata: { email, roleId: input.roleId, unitId: input.unitId ?? null },
      },
    });
    return created;
  });

  const [context, inviter] = await Promise.all([
    db.business.findUnique({
      where: { id: input.businessId },
      select: { name: true, roles: { where: { id: input.roleId }, select: { name: true } } },
    }),
    db.businessMembership.findFirst({
      where: { businessId: input.businessId, userId: input.userId },
      select: { user: { select: { name: true } } },
    }),
  ]);
  const delivery =
    context && context.roles[0]
      ? await sendInvitationEmail({
          email,
          token,
          businessName: context.name,
          roleName: context.roles[0].name,
          invitedByName: inviter?.user.name ?? "A Rungika administrator",
        })
      : { configured: false, sent: false };

  if (!delivery.sent) {
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: "INACTIVE" },
    });
  }

  return { invitationId: invitation.id, deliveryAvailable: delivery.sent };
}

export async function updatePersonMembership(input: {
  userId: string;
  businessId: string;
  membershipId: string;
  roleId: string;
  unitId?: string;
  jobTitle?: string;
  startDate?: string;
  status?: "ACTIVE" | "INACTIVE";
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "people.edit");
  const membership = await db.businessMembership.findFirst({
    where: { id: input.membershipId, businessId: input.businessId },
  });
  if (!membership) {
    throw new BusinessValidationError("The membership does not exist.");
  }
  if (membership.userId === input.userId && (input.status === "INACTIVE" || input.roleId !== membership.roleId)) {
    throw new BusinessValidationError("Owners cannot remove or demote their own owner membership.");
  }
  const role = await db.role.findFirst({ where: { id: input.roleId, businessId: input.businessId } });
  if (!role) {
    throw new BusinessValidationError("The selected role does not exist.");
  }
  if (input.unitId) {
    const unit = await db.businessUnit.findFirst({ where: { id: input.unitId, businessId: input.businessId } });
    if (!unit) {
      throw new BusinessValidationError("The selected unit does not exist.");
    }
  }
  let startDate: Date | null = null;
  if (input.startDate) {
    const parsed = new Date(`${input.startDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BusinessValidationError("The start date is invalid.");
    }
    startDate = parsed;
  }
  return db.businessMembership.update({
    where: { id: membership.id },
    data: {
      roleId: input.roleId,
      unitId: input.unitId || null,
      jobTitle: input.jobTitle?.trim() || null,
      startDate,
      status: input.status ?? membership.status,
    },
  });
}

export async function createBusinessRole(input: {
  userId: string;
  businessId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "people.manage_users");
  const permissionKeys = [...new Set(input.permissionKeys)].filter((key) =>
    Object.prototype.hasOwnProperty.call(BUSINESS_PERMISSION_DEFINITIONS, key),
  ) as BusinessPermissionKey[];
  if (permissionKeys.length === 0) {
    throw new BusinessValidationError("Select at least one permission for the role.");
  }
  return db.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({ where: { key: { in: permissionKeys } } });
    if (permissions.length !== permissionKeys.length) {
      throw new BusinessValidationError("One or more permissions are not configured.");
    }
    const role = await tx.role.create({
      data: {
        businessId: input.businessId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "ROLE.CREATED",
        entityType: "Role",
        entityId: role.id,
        metadata: { permissionKeys },
      },
    });
    return role;
  });
}

export async function updateBusinessRole(input: {
  userId: string;
  businessId: string;
  roleId: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  await assertOperationalBusinessAccess(input.userId, input.businessId, "people.manage_users");
  const role = await db.role.findFirst({ where: { id: input.roleId, businessId: input.businessId } });
  if (!role) {
    throw new BusinessValidationError("The role does not exist.");
  }
  if (role.isSystem) {
    throw new BusinessValidationError("System roles cannot be changed.");
  }
  const permissionKeys = [...new Set(input.permissionKeys)].filter((key) =>
    Object.prototype.hasOwnProperty.call(BUSINESS_PERMISSION_DEFINITIONS, key),
  ) as BusinessPermissionKey[];
  if (permissionKeys.length === 0) {
    throw new BusinessValidationError("Select at least one permission for the role.");
  }
  return db.$transaction(async (tx) => {
    const permissions = await tx.permission.findMany({ where: { key: { in: permissionKeys } } });
    if (permissions.length !== permissionKeys.length) {
      throw new BusinessValidationError("One or more permissions are not configured.");
    }
    const updated = await tx.role.update({
      where: { id: role.id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        actorId: input.userId,
        action: "ROLE.UPDATED",
        entityType: "Role",
        entityId: role.id,
        metadata: { permissionKeys },
      },
    });
    return updated;
  });
}

export async function markNotificationRead(input: {
  userId: string;
  businessId: string;
  notificationId: string;
}) {
  await assertBusinessPermission(input.userId, input.businessId, "notifications.edit");
  const result = await db.notification.updateMany({
    where: { id: input.notificationId, userId: input.userId, businessId: input.businessId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    throw new BusinessValidationError("The notification does not exist.");
  }
}

export async function markAllBusinessNotificationsRead(input: {
  userId: string;
  businessId: string;
}) {
  await assertBusinessPermission(input.userId, input.businessId, "notifications.edit");
  await db.notification.updateMany({
    where: { userId: input.userId, businessId: input.businessId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function createSupportCase(input: {
  userId: string;
  businessId: string;
  subject: string;
  message: string;
}) {
  await assertBusinessPermission(input.userId, input.businessId, "support.create");
  return db.supportCase.create({
    data: {
      businessId: input.businessId,
      reporterId: input.userId,
      subject: input.subject.trim(),
      message: input.message.trim(),
    },
  });
}

export async function updateSupportCase(input: {
  userId: string;
  businessId: string;
  caseId: string;
  status: SupportCaseStatus;
}) {
  await assertBusinessPermission(input.userId, input.businessId, "support.edit");
  const supportCase = await db.supportCase.findFirst({
    where: { id: input.caseId, businessId: input.businessId, reporterId: input.userId },
  });
  if (!supportCase) {
    throw new BusinessValidationError("The support case does not exist.");
  }
  if (supportCase.status === "CLOSED" || supportCase.status === "RESOLVED") {
    throw new BusinessConflictError("Resolved or closed support cases cannot be reopened from this view.");
  }
  await db.supportCase.update({ where: { id: supportCase.id }, data: { status: input.status } });
}

export function isCustomFieldType(value: string): value is FieldType {
  return Object.values(FieldType).includes(value as FieldType);
}
