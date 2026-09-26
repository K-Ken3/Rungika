import "server-only";

import {
  AdminRole,
  BusinessStatus,
  Prisma,
  SupportCaseStatus,
} from "@prisma/client";
import { redirect } from "next/navigation";

import type { AuthUser } from "@/lib/auth/types";
import { db } from "@/lib/db";

export class AdminDataError extends Error {}
export class AdminAuthorizationError extends AdminDataError {}

export type ActiveAdmin = {
  id: string;
  userId: string;
  role: AdminRole;
};

export async function requireActiveAdminMembership(user: AuthUser): Promise<ActiveAdmin> {
  const membership = await db.adminMembership.findFirst({
    where: {
      userId: user.id,
      active: true,
      user: { status: "ACTIVE" },
    },
    select: {
      id: true,
      userId: true,
      role: true,
    },
  });

  if (!membership) {
    redirect(user.memberships.length > 0 ? "/business" : "/onboarding");
  }

  return membership;
}

export async function requireActiveAdmin(user: AuthUser): Promise<ActiveAdmin> {
  return requireActiveAdminMembership(user);
}

export function requireAdminRole(admin: ActiveAdmin, roles: readonly AdminRole[]): void {
  if (!roles.includes(admin.role)) {
    throw new AdminAuthorizationError("Your administrator role cannot perform this action");
  }
}

function textValue(value: string | undefined, label: string, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new AdminDataError(`${label} is too long`);
  }
  return normalized;
}

function requiredText(value: string | undefined, label: string, maxLength: number): string {
  const normalized = textValue(value, label, maxLength);
  if (!normalized) {
    throw new AdminDataError(`${label} is required`);
  }
  return normalized;
}

function parsePage(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return Math.min(value, maximum);
}

function parsePageSize(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return 20;
  }
  return Math.min(value, 100);
}

function parseDate(value: string | undefined, label: string, endOfDay = false): Date | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AdminDataError(`${label} must use YYYY-MM-DD`);
  }
  const date = new Date(`${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new AdminDataError(`${label} is not a valid date`);
  }
  return date;
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string,
): T | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!allowed.includes(normalized as T)) {
    throw new AdminDataError(`${label} is invalid`);
  }
  return normalized as T;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export interface AdminDashboardData {
  periodDays: number;
  businessStatusCounts: Record<BusinessStatus, number>;
  totalBusinesses: number;
  claimsAwaitingReview: number;
  confirmedPaymentCount: number;
  confirmedPaymentTotals: Array<{
    currency: string;
    amountMinor: number;
    count: number;
  }>;
  upcomingRenewals: Array<{
    id: string;
    businessId: string;
    businessName: string;
    planName: string;
    dueDate: string;
    amountMinor: number;
    currency: string;
    status: string;
  }>;
  recentActions: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
    businessName: string | null;
  }>;
  notificationDeliveryCounts: Record<"FAILED" | "SKIPPED", number>;
  recentFailedDeliveries: Array<{
    id: string;
    channel: string;
    status: string;
    attempts: number;
    scheduledAt: string;
    error: string | null;
    notificationTitle: string;
  }>;
}

export async function getAdminDashboardData(periodDays = 30): Promise<AdminDashboardData> {
  const safePeriod =
    Number.isInteger(periodDays) && periodDays >= 1 && periodDays <= 365 ? periodDays : 30;
  const now = new Date();
  const periodStart = addDays(now, -safePeriod);
  const renewalEnd = addDays(now, 30);
  const businessStatuses: BusinessStatus[] = [
    "PENDING_PAYMENT",
    "ACTIVE",
    "GRACE_PERIOD",
    "PAUSED",
    "CANCELLED",
  ];

  const [businessGroups, totalBusinesses, claimsAwaitingReview, paymentTotals, renewals, actions, deliveryGroups, failedDeliveries] =
    await Promise.all([
      db.business.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      db.business.count(),
      db.paymentClaim.count({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
      db.payment.groupBy({
        by: ["currency"],
        where: {
          status: "CONFIRMED",
          confirmedAt: { gte: periodStart, lte: now },
        },
        _count: { _all: true },
        _sum: { amountMinor: true },
        orderBy: { currency: "asc" },
      }),
      db.subscription.findMany({
        where: {
          dueDate: { gte: now, lte: renewalEnd },
          status: { not: "CANCELLED" },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        select: {
          id: true,
          businessId: true,
          business: { select: { name: true } },
          planNameSnapshot: true,
          dueDate: true,
          amountMinor: true,
          currency: true,
          status: true,
        },
      }),
      db.auditLog.findMany({
        where: {
          OR: [
            { action: { startsWith: "PAYMENT" } },
            { action: { startsWith: "BUSINESS" } },
            { action: { startsWith: "INVOICE" } },
            { action: { startsWith: "SUBSCRIPTION" } },
            { action: { startsWith: "PLATFORM_SETTINGS" } },
            { action: { startsWith: "SUPPORT" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
          business: { select: { name: true } },
        },
      }),
      db.notificationDelivery.groupBy({
        by: ["status"],
        where: { status: { in: ["FAILED", "SKIPPED"] } },
        _count: { _all: true },
      }),
      db.notificationDelivery.findMany({
        where: { status: { in: ["FAILED", "SKIPPED"] } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          channel: true,
          status: true,
          attempts: true,
          scheduledAt: true,
          error: true,
          notification: { select: { title: true } },
        },
      }),
    ]);

  const businessStatusCounts = Object.fromEntries(
    businessStatuses.map((status) => [status, 0]),
  ) as Record<BusinessStatus, number>;
  for (const group of businessGroups) {
    businessStatusCounts[group.status] = group._count._all;
  }

  const notificationDeliveryCounts: AdminDashboardData["notificationDeliveryCounts"] = {
    FAILED: 0,
    SKIPPED: 0,
  };
  for (const group of deliveryGroups) {
    if (group.status === "FAILED" || group.status === "SKIPPED") {
      notificationDeliveryCounts[group.status] = group._count._all;
    }
  }

  return {
    periodDays: safePeriod,
    businessStatusCounts,
    totalBusinesses,
    claimsAwaitingReview,
    confirmedPaymentCount: paymentTotals.reduce((total, group) => total + group._count._all, 0),
    confirmedPaymentTotals: paymentTotals.map((group) => ({
      currency: group.currency,
      amountMinor: group._sum.amountMinor ?? 0,
      count: group._count._all,
    })),
    upcomingRenewals: renewals.map((renewal) => ({
      id: renewal.id,
      businessId: renewal.businessId,
      businessName: renewal.business.name,
      planName: renewal.planNameSnapshot,
      dueDate: renewal.dueDate.toISOString(),
      amountMinor: renewal.amountMinor,
      currency: renewal.currency,
      status: renewal.status,
    })),
    recentActions: actions.map((action) => ({
      id: action.id,
      action: action.action,
      entityType: action.entityType,
      entityId: action.entityId,
      createdAt: action.createdAt.toISOString(),
      actorName: action.actor?.name ?? null,
      actorEmail: action.actor?.email ?? null,
      businessName: action.business?.name ?? null,
    })),
    notificationDeliveryCounts,
    recentFailedDeliveries: failedDeliveries.map((delivery) => ({
      id: delivery.id,
      channel: delivery.channel,
      status: delivery.status,
      attempts: delivery.attempts,
      scheduledAt: delivery.scheduledAt.toISOString(),
      error: delivery.error,
      notificationTitle: delivery.notification.title,
    })),
  };
}

export interface BusinessListQuery {
  search?: string;
  owner?: string;
  status?: string;
  plan?: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  pageSize?: number;
}

export interface BusinessListItem {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  country: string;
  status: BusinessStatus;
  adminHold: boolean;
  createdAt: string;
  createdByName: string;
  createdByEmail: string;
  memberCount: number;
  planName: string | null;
  subscriptionStatus: string | null;
  dueDate: string | null;
  amountMinor: number | null;
  currency: string | null;
}

export interface BusinessListResult {
  items: BusinessListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  plans: string[];
  error: string | null;
}

export async function listBusinesses(query: BusinessListQuery = {}): Promise<BusinessListResult> {
  const page = parsePage(query.page, 1, 100_000);
  const pageSize = parsePageSize(query.pageSize);
  let error: string | null = null;
  const filters: Prisma.BusinessWhereInput[] = [];

  try {
    const search = textValue(query.search, "Search", 120);
    const owner = textValue(query.owner, "Owner", 120);
    const status = parseEnum(query.status, [
      "PENDING_PAYMENT",
      "ACTIVE",
      "GRACE_PERIOD",
      "PAUSED",
      "CANCELLED",
    ] as const, "Status");
    const plan = textValue(query.plan, "Plan", 80);
    const createdFrom = parseDate(query.createdFrom, "Created from");
    const createdTo = parseDate(query.createdTo, "Created to", true);
    const dueFrom = parseDate(query.dueFrom, "Due from");
    const dueTo = parseDate(query.dueTo, "Due to", true);

    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new AdminDataError("Created from must be before created to");
    }
    if (dueFrom && dueTo && dueFrom > dueTo) {
      throw new AdminDataError("Due from must be before due to");
    }

    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (owner) {
      filters.push({
        OR: [
          { createdBy: { name: { contains: owner, mode: "insensitive" } } },
          { createdBy: { email: { contains: owner, mode: "insensitive" } } },
          {
            memberships: {
              some: {
                user: {
                  OR: [
                    { name: { contains: owner, mode: "insensitive" } },
                    { email: { contains: owner, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    if (status) {
      filters.push({ status });
    }
    if (plan) {
      filters.push({
        subscription: { planNameSnapshot: { contains: plan, mode: "insensitive" } },
      });
    }
    if (createdFrom || createdTo) {
      filters.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {}),
        },
      });
    }
    if (dueFrom || dueTo) {
      filters.push({
        subscription: {
          is: {
            dueDate: {
              ...(dueFrom ? { gte: dueFrom } : {}),
              ...(dueTo ? { lte: dueTo } : {}),
            },
          },
        },
      });
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Invalid business filters";
  }

  if (error) {
    return { items: [], total: 0, page, pageSize, totalPages: 0, plans: [], error };
  }

  const where: Prisma.BusinessWhereInput = filters.length ? { AND: filters } : {};
  const [rows, total, planRows] = await db.$transaction([
    db.business.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        country: true,
        status: true,
        adminHold: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { memberships: true } },
        subscription: {
          select: {
            planNameSnapshot: true,
            status: true,
            dueDate: true,
            amountMinor: true,
            currency: true,
          },
        },
      },
    }),
    db.business.count({ where }),
    db.subscription.findMany({
      distinct: ["planNameSnapshot"],
      orderBy: { planNameSnapshot: "asc" },
      select: { planNameSnapshot: true },
    }),
  ]);

  return {
    items: rows.map((business) => ({
      id: business.id,
      name: business.name,
      slug: business.slug,
      category: business.category,
      country: business.country,
      status: business.status,
      adminHold: business.adminHold,
      createdAt: business.createdAt.toISOString(),
      createdByName: business.createdBy.name,
      createdByEmail: business.createdBy.email,
      memberCount: business._count.memberships,
      planName: business.subscription?.planNameSnapshot ?? null,
      subscriptionStatus: business.subscription?.status ?? null,
      dueDate: iso(business.subscription?.dueDate),
      amountMinor: business.subscription?.amountMinor ?? null,
      currency: business.subscription?.currency ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    plans: planRows.map((row) => row.planNameSnapshot),
    error: null,
  };
}

export interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  country: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  status: BusinessStatus;
  adminHold: boolean;
  pauseReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string; email: string };
  owner: { name: string; email: string } | null;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    unitName: string | null;
  }>;
  subscription: {
    id: string;
    planNameSnapshot: string;
    amountMinor: number;
    currency: string;
    interval: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    dueDate: string;
    graceEndsAt: string | null;
    pausedAt: string | null;
    autoRenew: boolean;
  } | null;
  invoices: Array<{
    id: string;
    number: string;
    amountMinor: number;
    currency: string;
    status: string;
    dueDate: string;
    paidAt: string | null;
  }>;
  claims: Array<{
    id: string;
    reference: string;
    amountMinor: number;
    currency: string;
    status: string;
    sentAt: string;
    proofName: string | null;
    proofMime: string | null;
    submittedByName: string;
    invoiceNumber: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actorName: string | null;
    metadata: Prisma.JsonValue | null;
  }>;
  supportCases: Array<{
    id: string;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
    reporterName: string;
  }>;
  adminNotes: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
  }>;
}

export async function getBusinessDetail(businessId: string): Promise<BusinessDetail | null> {
  const id = requiredText(businessId, "Business id", 100);
  const business = await db.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      description: true,
      country: true,
      location: true,
      phone: true,
      email: true,
      timezone: true,
      currency: true,
      status: true,
      adminHold: true,
      pauseReason: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true, email: true } },
      _count: { select: { memberships: true } },
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          status: true,
          role: { select: { name: true } },
          unit: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      },
      subscription: {
        select: {
          id: true,
          planNameSnapshot: true,
          amountMinor: true,
          currency: true,
          interval: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          dueDate: true,
          graceEndsAt: true,
          pausedAt: true,
          autoRenew: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          amountMinor: true,
          currency: true,
          status: true,
          dueDate: true,
          paidAt: true,
        },
      },
      paymentClaims: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          reference: true,
          amountMinor: true,
          currency: true,
          status: true,
          sentAt: true,
          proofName: true,
          proofMime: true,
          submittedBy: { select: { name: true } },
          invoice: { select: { number: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          metadata: true,
          actor: { select: { name: true } },
        },
      },
      supportCases: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
          reporter: { select: { name: true } },
        },
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!business) {
    return null;
  }

  const ownerMembership = business.memberships.find((membership) => membership.role.name === "OWNER");
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    description: business.description,
    country: business.country,
    location: business.location,
    phone: business.phone,
    email: business.email,
    timezone: business.timezone,
    currency: business.currency,
    status: business.status,
    adminHold: business.adminHold,
    pauseReason: business.pauseReason,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
    createdBy: business.createdBy,
    owner: ownerMembership
      ? { name: ownerMembership.user.name, email: ownerMembership.user.email }
      : { name: business.createdBy.name, email: business.createdBy.email },
    memberCount: business._count.memberships,
    members: business.memberships.map((membership) => ({
      id: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role.name,
      status: membership.status,
      unitName: membership.unit?.name ?? null,
    })),
    subscription: business.subscription
      ? {
          id: business.subscription.id,
          planNameSnapshot: business.subscription.planNameSnapshot,
          amountMinor: business.subscription.amountMinor,
          currency: business.subscription.currency,
          interval: business.subscription.interval,
          status: business.subscription.status,
          currentPeriodStart: business.subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: business.subscription.currentPeriodEnd.toISOString(),
          dueDate: business.subscription.dueDate.toISOString(),
          graceEndsAt: iso(business.subscription.graceEndsAt),
          pausedAt: iso(business.subscription.pausedAt),
          autoRenew: business.subscription.autoRenew,
        }
      : null,
    invoices: business.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      paidAt: iso(invoice.paidAt),
    })),
    claims: business.paymentClaims.map((claim) => ({
      id: claim.id,
      reference: claim.reference,
      amountMinor: claim.amountMinor,
      currency: claim.currency,
      status: claim.status,
      sentAt: claim.sentAt.toISOString(),
      proofName: claim.proofName,
      proofMime: claim.proofMime,
      submittedByName: claim.submittedBy.name,
      invoiceNumber: claim.invoice.number,
    })),
    auditLogs: business.auditLogs.map((auditLog) => ({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      createdAt: auditLog.createdAt.toISOString(),
      actorName: auditLog.actor?.name ?? null,
      metadata: auditLog.metadata,
    })),
    supportCases: business.supportCases.map((supportCase) => ({
      id: supportCase.id,
      subject: supportCase.subject,
      message: supportCase.message,
      status: supportCase.status,
      createdAt: supportCase.createdAt.toISOString(),
      reporterName: supportCase.reporter.name,
    })),
    adminNotes: business.adminNotes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      authorName: note.author.name,
    })),
  };
}

export interface PaymentClaimQueueItem {
  id: string;
  businessId: string;
  businessName: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  reference: string;
  note: string | null;
  sentAt: string;
  status: "SUBMITTED" | "UNDER_REVIEW";
  submittedByName: string;
  submittedByEmail: string;
  underReviewByName: string | null;
  proofKeyAvailable: boolean;
  proofName: string | null;
  proofMime: string | null;
  duplicateReference: boolean;
  duplicateBusinessName: string | null;
}

export interface PaymentClaimQueueResult {
  items: PaymentClaimQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
}

export async function listPaymentClaims(
  query: { search?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<PaymentClaimQueueResult> {
  const page = parsePage(query.page, 1, 100_000);
  const pageSize = parsePageSize(query.pageSize);
  let error: string | null = null;
  let status: "SUBMITTED" | "UNDER_REVIEW" | undefined;
  let search: string | undefined;
  const where: Prisma.PaymentClaimWhereInput = {
    status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
  };

  try {
    status = parseEnum(query.status, ["SUBMITTED", "UNDER_REVIEW"] as const, "Claim status");
    search = textValue(query.search, "Search", 120);
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { business: { name: { contains: search, mode: "insensitive" } } },
        { invoice: { number: { contains: search, mode: "insensitive" } } },
        { submittedBy: { name: { contains: search, mode: "insensitive" } } },
        { submittedBy: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Invalid payment claim filters";
  }

  if (error) {
    return { items: [], total: 0, page, pageSize, totalPages: 0, error };
  }

  const [rows, total] = await db.$transaction([
    db.paymentClaim.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        businessId: true,
        business: { select: { name: true } },
        invoiceId: true,
        invoice: { select: { number: true } },
        amountMinor: true,
        currency: true,
        reference: true,
        note: true,
        sentAt: true,
        status: true,
        proofKey: true,
        proofName: true,
        proofMime: true,
        submittedBy: { select: { name: true, email: true } },
        underReviewBy: { select: { name: true } },
      },
    }),
    db.paymentClaim.count({ where }),
  ]);

  const references = [...new Set(rows.map((row) => row.reference))];
  const [otherClaims, existingPayments] = references.length
    ? await Promise.all([
        db.paymentClaim.findMany({
          where: {
            reference: { in: references },
            id: { notIn: rows.map((row) => row.id) },
          },
          select: { reference: true, business: { select: { name: true } } },
        }),
        db.payment.findMany({
          where: { reference: { in: references } },
          select: { reference: true, business: { select: { name: true } } },
        }),
      ])
    : [[], []];
  const duplicateMap = new Map<string, string | null>();
  for (const item of [...otherClaims, ...existingPayments]) {
    duplicateMap.set(item.reference, item.business.name);
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      businessId: row.businessId,
      businessName: row.business.name,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoice.number,
      amountMinor: row.amountMinor,
      currency: row.currency,
      reference: row.reference,
      note: row.note,
      sentAt: row.sentAt.toISOString(),
      status: row.status as "SUBMITTED" | "UNDER_REVIEW",
      submittedByName: row.submittedBy.name,
      submittedByEmail: row.submittedBy.email,
      underReviewByName: row.underReviewBy?.name ?? null,
      proofKeyAvailable: Boolean(row.proofKey),
      proofName: row.proofName,
      proofMime: row.proofMime,
      duplicateReference: duplicateMap.has(row.reference),
      duplicateBusinessName: duplicateMap.get(row.reference) ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    error: null,
  };
}

export interface OpenInvoiceOption {
  invoiceId: string;
  businessId: string;
  businessName: string;
  subscriptionId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  status: string;
}

export async function listOpenInvoiceOptions(search?: string): Promise<OpenInvoiceOption[]> {
  const normalized = search?.trim();
  const rows = await db.invoice.findMany({
    where: {
      status: { in: ["OPEN", "OVERDUE"] },
      payment: null,
      ...(normalized
        ? {
            OR: [
              { number: { contains: normalized, mode: "insensitive" as const } },
              { business: { name: { contains: normalized, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { dueDate: "asc" },
    take: 200,
    select: {
      id: true,
      businessId: true,
      business: { select: { name: true } },
      subscriptionId: true,
      number: true,
      amountMinor: true,
      currency: true,
      dueDate: true,
      status: true,
    },
  });
  return rows.map((row) => ({
    invoiceId: row.id,
    businessId: row.businessId,
    businessName: row.business.name,
    subscriptionId: row.subscriptionId,
    invoiceNumber: row.number,
    amountMinor: row.amountMinor,
    currency: row.currency,
    dueDate: row.dueDate.toISOString(),
    status: row.status,
  }));
}

export interface PaymentHistoryItem {
  id: string;
  businessId: string;
  businessName: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  reference: string;
  method: string;
  status: string;
  receiptNumber: string;
  confirmedAt: string;
  adminName: string;
  adminEmail: string;
}

export interface PaymentHistoryResult {
  items: PaymentHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
}

export async function listPaymentHistory(
  query: {
    search?: string;
    status?: string;
    method?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PaymentHistoryResult> {
  const page = parsePage(query.page, 1, 100_000);
  const pageSize = parsePageSize(query.pageSize);
  let error: string | null = null;
  let status: "CONFIRMED" | "REVERSED" | undefined;
  let method: "MOMO" | "MANUAL" | undefined;
  let search: string | undefined;
  let from: Date | undefined;
  let to: Date | undefined;
  const where: Prisma.PaymentWhereInput = {};

  try {
    status = parseEnum(query.status, ["CONFIRMED", "REVERSED"] as const, "Payment status");
    method = parseEnum(query.method, ["MOMO", "MANUAL"] as const, "Payment method");
    search = textValue(query.search, "Search", 120);
    from = parseDate(query.from, "From");
    to = parseDate(query.to, "To", true);
    if (from && to && from > to) {
      throw new AdminDataError("From must be before to");
    }
    if (status) where.status = status;
    if (method) where.method = method;
    if (from || to) {
      where.confirmedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { business: { name: { contains: search, mode: "insensitive" } } },
        { invoice: { number: { contains: search, mode: "insensitive" } } },
      ];
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Invalid payment history filters";
  }

  if (error) {
    return { items: [], total: 0, page, pageSize, totalPages: 0, error };
  }

  const [rows, total] = await db.$transaction([
    db.payment.findMany({
      where,
      orderBy: { confirmedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        businessId: true,
        business: { select: { name: true } },
        invoice: { select: { id: true, number: true } },
        amountMinor: true,
        currency: true,
        reference: true,
        method: true,
        status: true,
        receiptNumber: true,
        confirmedAt: true,
        admin: { select: { user: { select: { name: true, email: true } } } },
      },
    }),
    db.payment.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      businessId: row.businessId,
      businessName: row.business.name,
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.number,
      amountMinor: row.amountMinor,
      currency: row.currency,
      reference: row.reference,
      method: row.method,
      status: row.status,
      receiptNumber: row.receiptNumber,
      confirmedAt: row.confirmedAt.toISOString(),
      adminName: row.admin.user.name,
      adminEmail: row.admin.user.email,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    error: null,
  };
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  businessId: string | null;
  businessName: string | null;
  metadata: Prisma.JsonValue | null;
}

export interface AuditLogResult {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
}

export async function listAuditLogs(
  query: {
    search?: string;
    action?: string;
    entityType?: string;
    businessId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AuditLogResult> {
  const page = parsePage(query.page, 1, 100_000);
  const pageSize = parsePageSize(query.pageSize);
  let error: string | null = null;
  let search: string | undefined;
  let action: string | undefined;
  let entityType: string | undefined;
  let businessId: string | undefined;
  let from: Date | undefined;
  let to: Date | undefined;
  const where: Prisma.AuditLogWhereInput = {};

  try {
    search = textValue(query.search, "Search", 120);
    action = textValue(query.action, "Action", 80);
    entityType = textValue(query.entityType, "Entity type", 80);
    businessId = textValue(query.businessId, "Business id", 100);
    from = parseDate(query.from, "From");
    to = parseDate(query.to, "To", true);
    if (from && to && from > to) {
      throw new AdminDataError("From must be before to");
    }
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entityType) where.entityType = { contains: entityType, mode: "insensitive" };
    if (businessId) where.businessId = businessId;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { actor: { name: { contains: search, mode: "insensitive" } } },
        { actor: { email: { contains: search, mode: "insensitive" } } },
        { business: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Invalid audit filters";
  }

  if (error) {
    return { items: [], total: 0, page, pageSize, totalPages: 0, error };
  }

  const [rows, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadata: true,
        actor: { select: { name: true, email: true } },
        business: { select: { id: true, name: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt.toISOString(),
      actorName: row.actor?.name ?? null,
      actorEmail: row.actor?.email ?? null,
      businessId: row.business?.id ?? null,
      businessName: row.business?.name ?? null,
      metadata: row.metadata,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    error: null,
  };
}

export interface AdminUserItem {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  userStatus: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  lastBusinessCount: number;
}

export async function listAdminUsers(): Promise<AdminUserItem[]> {
  const rows = await db.adminMembership.findMany({
    orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
    select: {
      id: true,
      userId: true,
      role: true,
      active: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
          status: true,
          _count: { select: { memberships: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    membershipId: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    userStatus: row.user.status,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    lastBusinessCount: row.user._count.memberships,
  }));
}

export interface BusinessMutationResult {
  businessId: string;
  status: BusinessStatus;
  adminHold: boolean;
}

export async function pauseBusiness(
  admin: ActiveAdmin,
  businessId: string,
  reason: string,
): Promise<BusinessMutationResult> {
  requireAdminRole(admin, ["SUPER_ADMIN"]);
  const id = requiredText(businessId, "Business id", 100);
  const pauseReason = requiredText(reason, "Pause reason", 500);
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id }, select: { id: true, status: true, adminHold: true } });
    if (!business) {
      throw new AdminDataError("Business not found");
    }
    const updated = await tx.business.update({
      where: { id },
      data: { status: "PAUSED", pauseReason },
      select: { id: true, status: true, adminHold: true },
    });
    const subscription = await tx.subscription.findUnique({ where: { businessId: id }, select: { id: true, status: true } });
    if (subscription && subscription.status !== "PAUSED" && subscription.status !== "CANCELLED") {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "PAUSED", pausedAt: new Date(), graceEndsAt: null } });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: subscription.id, fromStatus: subscription.status, toStatus: "PAUSED", reason: pauseReason, changedById: admin.userId },
      });
    }
    await tx.auditLog.create({
      data: {
        businessId: id,
        actorId: admin.userId,
        action: "BUSINESS.PAUSED",
        entityType: "Business",
        entityId: id,
        metadata: { reason: pauseReason, previousStatus: business.status },
      },
    });
    return { businessId: updated.id, status: updated.status, adminHold: updated.adminHold };
  });
}

export async function reactivateBusiness(
  admin: ActiveAdmin,
  businessId: string,
  reason: string,
): Promise<BusinessMutationResult> {
  requireAdminRole(admin, ["SUPER_ADMIN"]);
  const id = requiredText(businessId, "Business id", 100);
  const reactivationReason = requiredText(reason, "Reactivation reason", 500);
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id }, select: { id: true, status: true, adminHold: true } });
    if (!business) {
      throw new AdminDataError("Business not found");
    }
    const updated = await tx.business.update({
      where: { id },
      data: { status: "ACTIVE", pauseReason: null },
      select: { id: true, status: true, adminHold: true },
    });
    const subscription = await tx.subscription.findUnique({ where: { businessId: id }, select: { id: true, status: true } });
    if (subscription && subscription.status !== "ACTIVE" && subscription.status !== "CANCELLED") {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", pausedAt: null, graceEndsAt: null } });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: subscription.id, fromStatus: subscription.status, toStatus: "ACTIVE", reason: reactivationReason, changedById: admin.userId },
      });
    }
    await tx.auditLog.create({
      data: {
        businessId: id,
        actorId: admin.userId,
        action: "BUSINESS.REACTIVATED",
        entityType: "Business",
        entityId: id,
        metadata: { reason: reactivationReason, previousStatus: business.status },
      },
    });
    return { businessId: updated.id, status: updated.status, adminHold: updated.adminHold };
  });
}

export async function setBusinessAdminHold(
  admin: ActiveAdmin,
  businessId: string,
  hold: boolean,
  reason: string,
): Promise<BusinessMutationResult> {
  requireAdminRole(admin, ["SUPER_ADMIN"]);
  const id = requiredText(businessId, "Business id", 100);
  const holdReason = requiredText(reason, "Hold reason", 500);
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id }, select: { id: true, status: true, adminHold: true } });
    if (!business) {
      throw new AdminDataError("Business not found");
    }
    const updated = await tx.business.update({
      where: { id },
      data: { adminHold: hold },
      select: { id: true, status: true, adminHold: true },
    });
    await tx.auditLog.create({
      data: {
        businessId: id,
        actorId: admin.userId,
        action: hold ? "BUSINESS.ADMIN_HOLD_SET" : "BUSINESS.ADMIN_HOLD_RELEASED",
        entityType: "Business",
        entityId: id,
        metadata: { reason: holdReason },
      },
    });
    return { businessId: updated.id, status: updated.status, adminHold: updated.adminHold };
  });
}

export async function addBusinessNote(
  admin: ActiveAdmin,
  businessId: string,
  body: string,
): Promise<{ id: string }> {
  requireAdminRole(admin, ["SUPER_ADMIN", "SUPPORT"]);
  const id = requiredText(businessId, "Business id", 100);
  const noteBody = requiredText(body, "Note", 2000);
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id }, select: { id: true } });
    if (!business) {
      throw new AdminDataError("Business not found");
    }
    const note = await tx.businessAdminNote.create({
      data: { businessId: id, authorId: admin.userId, body: noteBody },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        businessId: id,
        actorId: admin.userId,
        action: "BUSINESS.ADMIN_NOTE_CREATED",
        entityType: "BusinessAdminNote",
        entityId: note.id,
        metadata: { characterCount: noteBody.length },
      },
    });
    return note;
  });
}

export async function updateSupportCaseStatus(
  admin: ActiveAdmin,
  caseId: string,
  status: SupportCaseStatus,
  reason: string,
): Promise<void> {
  requireAdminRole(admin, ["SUPER_ADMIN", "SUPPORT"]);
  const id = requiredText(caseId, "Support case id", 100);
  const updateReason = requiredText(reason, "Support update reason", 500);
  await db.$transaction(async (tx) => {
    const supportCase = await tx.supportCase.findUnique({ where: { id }, select: { id: true, businessId: true, status: true } });
    if (!supportCase) {
      throw new AdminDataError("Support case not found");
    }
    await tx.supportCase.update({ where: { id }, data: { status } });
    await tx.auditLog.create({
      data: {
        businessId: supportCase.businessId,
        actorId: admin.userId,
        action: "SUPPORT.CASE_STATUS_UPDATED",
        entityType: "SupportCase",
        entityId: id,
        metadata: { previousStatus: supportCase.status, status, reason: updateReason },
      },
      });
  });
}

