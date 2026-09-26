import "server-only";

import { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { randomUUID } from "node:crypto";

import {
  DEFAULT_APPROACHING_DUE_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_PAST_DUE_PAUSE_DAYS,
  DEFAULT_SUBSCRIPTION_PLAN,
  BillingAuthorizationError,
  BillingConflictError,
  BillingNotFoundError,
  BillingValidationError,
  assertPositiveMinorUnits,
  assertTransitionAllowed,
  calculateBillingDates,
  calculateNextBillingEdge,
  planSubscriptionTransition,
  shouldPauseSubscription,
  type BillingInterval,
  type StoredSubscriptionStatus,
  type SubscriptionStatusInput,
  type SubscriptionStateOptions,
} from "../billing";

type Tx = Prisma.TransactionClient;

const globalWithPrisma = globalThis as typeof globalThis & { rungikaPrisma?: PrismaClient };

export const prisma = globalWithPrisma.rungikaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalWithPrisma.rungikaPrisma = prisma;
}

export interface SubscriptionDTO {
  id: string;
  businessId: string;
  planId: string | null;
  planNameSnapshot: string;
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  status: StoredSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  dueDate: string;
  graceEndsAt: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDTO {
  id: string;
  businessId: string;
  subscriptionId: string;
  number: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "OPEN" | "PAID" | "VOID" | "OVERDUE";
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentClaimDTO {
  id: string;
  businessId: string;
  invoiceId: string;
  submittedById: string;
  amountMinor: number;
  currency: string;
  sentAt: string;
  reference: string;
  note: string | null;
  proofName: string | null;
  proofMime: string | null;
  proofAvailable: boolean;
  status: "SUBMITTED" | "UNDER_REVIEW" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  underReviewById: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDTO {
  id: string;
  businessId: string;
  subscriptionId: string;
  invoiceId: string;
  claimId: string | null;
  adminId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  method: "MOMO" | "MANUAL";
  kind: "PAYMENT" | "REFUND" | "REVERSAL" | "ADJUSTMENT";
  status: "CONFIRMED" | "REVERSED";
  periodStart: string;
  periodEnd: string;
  receiptNumber: string;
  notes: string | null;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toValidDate(value: Date | string | number, label: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new BillingValidationError(`${label} must be a valid date`);
  }
  return date;
}

function mapSubscription(value: unknown): SubscriptionDTO {
  const source = value as {
    id: string;
    businessId: string;
    planId: string | null;
    planNameSnapshot: string;
    amountMinor: number;
    currency: string;
    interval: BillingInterval;
    status: StoredSubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    dueDate: Date;
    graceEndsAt: Date | null;
    pausedAt: Date | null;
    cancelledAt: Date | null;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: source.id,
    businessId: source.businessId,
    planId: source.planId,
    planNameSnapshot: source.planNameSnapshot,
    amountMinor: source.amountMinor,
    currency: source.currency,
    interval: source.interval,
    status: source.status,
    currentPeriodStart: source.currentPeriodStart.toISOString(),
    currentPeriodEnd: source.currentPeriodEnd.toISOString(),
    dueDate: source.dueDate.toISOString(),
    graceEndsAt: toIso(source.graceEndsAt),
    pausedAt: toIso(source.pausedAt),
    cancelledAt: toIso(source.cancelledAt),
    autoRenew: source.autoRenew,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function mapInvoice(value: unknown): InvoiceDTO {
  const source = value as {
    id: string;
    businessId: string;
    subscriptionId: string;
    number: string;
    amountMinor: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    status: "OPEN" | "PAID" | "VOID" | "OVERDUE";
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: source.id,
    businessId: source.businessId,
    subscriptionId: source.subscriptionId,
    number: source.number,
    amountMinor: source.amountMinor,
    currency: source.currency,
    periodStart: source.periodStart.toISOString(),
    periodEnd: source.periodEnd.toISOString(),
    dueDate: source.dueDate.toISOString(),
    status: source.status,
    paidAt: toIso(source.paidAt),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function mapPaymentClaim(value: unknown): PaymentClaimDTO {
  const source = value as {
    id: string;
    businessId: string;
    invoiceId: string;
    submittedById: string;
    amountMinor: number;
    currency: string;
    sentAt: Date;
    reference: string;
    note: string | null;
    proofKey: string | null;
    proofName: string | null;
    proofMime: string | null;
    status: "SUBMITTED" | "UNDER_REVIEW" | "CONFIRMED" | "REJECTED" | "CANCELLED";
    underReviewById: string | null;
    reviewedAt: Date | null;
    decisionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: source.id,
    businessId: source.businessId,
    invoiceId: source.invoiceId,
    submittedById: source.submittedById,
    amountMinor: source.amountMinor,
    currency: source.currency,
    sentAt: source.sentAt.toISOString(),
    reference: source.reference,
    note: source.note,
    proofName: source.proofName,
    proofMime: source.proofMime,
    proofAvailable: Boolean(source.proofKey),
    status: source.status,
    underReviewById: source.underReviewById,
    reviewedAt: toIso(source.reviewedAt),
    decisionReason: source.decisionReason,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function mapPayment(value: unknown): PaymentDTO {
  const source = value as {
    id: string;
    businessId: string;
    subscriptionId: string;
    invoiceId: string;
    claimId: string | null;
    adminId: string;
    amountMinor: number;
    currency: string;
    reference: string;
    method: "MOMO" | "MANUAL";
    kind: "PAYMENT" | "REFUND" | "REVERSAL" | "ADJUSTMENT";
    status: "CONFIRMED" | "REVERSED";
    periodStart: Date;
    periodEnd: Date;
    receiptNumber: string;
    notes: string | null;
    confirmedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    id: source.id,
    businessId: source.businessId,
    subscriptionId: source.subscriptionId,
    invoiceId: source.invoiceId,
    claimId: source.claimId,
    adminId: source.adminId,
    amountMinor: source.amountMinor,
    currency: source.currency,
    reference: source.reference,
    method: source.method,
    kind: source.kind,
    status: source.status,
    periodStart: source.periodStart.toISOString(),
    periodEnd: source.periodEnd.toISOString(),
    receiptNumber: source.receiptNumber,
    notes: source.notes,
    confirmedAt: source.confirmedAt.toISOString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function assertNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BillingValidationError(`${label} must not be empty`);
  }
  return normalized;
}

function normalizeCurrency(value: string): string {
  const normalized = assertNonEmpty(value, "Currency");
  return normalized.toUpperCase();
}

function generateNumber(prefix: string): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `${prefix}${suffix}`;
}

interface AdminContext {
  id: string;
  userId: string;
  role: string;
}

async function requireBillingAdmin(tx: Tx, adminMembershipId: string): Promise<AdminContext> {
  const membership = await tx.adminMembership.findFirst({
    where: {
      id: adminMembershipId,
      active: true,
      role: { in: ["SUPER_ADMIN", "FINANCE"] },
    },
  });
  if (!membership) {
    throw new BillingAuthorizationError("Active SUPER_ADMIN or FINANCE membership required");
  }
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
  };
}

async function getBusinessMemberIds(tx: Tx, businessId: string): Promise<string[]> {
  const memberships = await tx.businessMembership.findMany({
    where: { businessId, status: "ACTIVE" },
    select: { userId: true },
  });
  return memberships.map((membership: { userId: string }) => membership.userId);
}

interface NotificationInput {
  businessId: string;
  type: NotificationType;
  title: string;
  message: string;
  marker: Prisma.InputJsonObject;
  now: Date;
}

async function notifyInAppMembers(tx: Tx, input: NotificationInput): Promise<string[]> {
  const userIds = await getBusinessMemberIds(tx, input.businessId);
  const created: string[] = [];
  for (const userId of userIds) {
    const existing = await tx.notification.findFirst({
      where: {
        userId,
        businessId: input.businessId,
        type: input.type,
        data: { equals: input.marker },
      },
    });
    if (existing) {
      continue;
    }
    const notification = await tx.notification.create({
      data: {
        userId,
        businessId: input.businessId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.marker,
      },
    });
    await tx.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: "IN_APP",
        status: "PENDING",
        scheduledAt: input.now,
      },
    });
    created.push(notification.id);
  }
  return created;
}

interface AuditInput {
  businessId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
}

async function recordAudit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      businessId: input.businessId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

interface ApplyPaidPeriodInput {
  businessId: string;
  subscriptionId: string;
  invoicePeriodStart: Date;
  invoicePeriodEnd: Date;
  interval: BillingInterval;
  now: Date;
  reason: string;
  changedById: string;
  adminHold: boolean;
  currentBusinessStatus: string;
}

interface ApplyPaidPeriodResult {
  previousStatus: StoredSubscriptionStatus;
  nextDueDate: Date;
  subscription: unknown;
}

async function applyPaidPeriod(tx: Tx, input: ApplyPaidPeriodInput): Promise<ApplyPaidPeriodResult> {
  const snapshot = await tx.subscription.findFirst({
    where: { id: input.subscriptionId, businessId: input.businessId },
  });
  if (!snapshot) {
    throw new BillingNotFoundError("Subscription not found");
  }
  const previousStatus = snapshot.status as StoredSubscriptionStatus;
  const nextDueDate = calculateNextBillingEdge(input.invoicePeriodEnd, input.interval, input.now);
  const nextPeriodStart =
    previousStatus === "ACTIVE" ? snapshot.currentPeriodStart : input.invoicePeriodStart;
  const updated = await tx.subscription.update({
    where: { id: input.subscriptionId },
    data: {
      status: "ACTIVE",
      currentPeriodStart: nextPeriodStart,
      currentPeriodEnd: nextDueDate,
      dueDate: nextDueDate,
      graceEndsAt: null,
      pausedAt: null,
      cancelledAt: null,
    },
  });
  if (!input.adminHold) {
    await tx.business.update({
      where: { id: input.businessId },
      data: { status: "ACTIVE", pauseReason: null },
    });
  }
  await tx.subscriptionStatusHistory.create({
    data: {
      subscriptionId: input.subscriptionId,
      fromStatus: previousStatus,
      toStatus: "ACTIVE",
      reason: input.reason,
      changedById: input.changedById,
    },
  });
  return { previousStatus, nextDueDate, subscription: updated };
}

export interface CreateBusinessSubscriptionInput {
  businessId: string;
  planName?: string;
  amountMinor?: number;
  currency?: string;
  interval?: BillingInterval;
  periodStart?: Date | string;
  createdByUserId?: string;
}

export interface SubscriptionCreationDTO {
  subscription: SubscriptionDTO;
  invoice: InvoiceDTO;
}

export async function createBusinessSubscription(
  input: CreateBusinessSubscriptionInput,
): Promise<SubscriptionCreationDTO> {
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const planName = assertNonEmpty(input.planName ?? DEFAULT_SUBSCRIPTION_PLAN.planName, "Plan name");
  const amountMinor = input.amountMinor ?? DEFAULT_SUBSCRIPTION_PLAN.amountMinor;
  const currency = normalizeCurrency(input.currency ?? DEFAULT_SUBSCRIPTION_PLAN.currency);
  const interval = input.interval ?? DEFAULT_SUBSCRIPTION_PLAN.interval;
  const periodStart = toValidDate(input.periodStart ?? new Date(), "Period start");
  assertPositiveMinorUnits(amountMinor);

  return prisma.$transaction(async (tx: Tx) => {
    const business = await tx.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new BillingNotFoundError("Business not found");
    }
    const existing = await tx.subscription.findUnique({ where: { businessId } });
    if (existing) {
      throw new BillingConflictError("Business already has a subscription");
    }
    const cycle = calculateBillingDates(periodStart, interval);
    const invoiceNumber = generateNumber("INV-");
    const subscription = await tx.subscription.create({
      data: {
        businessId,
        planId: null,
        planNameSnapshot: planName,
        amountMinor,
        currency,
        interval,
        status: "PENDING_PAYMENT",
        currentPeriodStart: cycle.periodStart,
        currentPeriodEnd: cycle.periodEnd,
        dueDate: cycle.dueDate,
        autoRenew: true,
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        businessId,
        subscriptionId: subscription.id,
        number: invoiceNumber,
        amountMinor,
        currency,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        dueDate: cycle.dueDate,
        status: "OPEN",
      },
    });
    await recordAudit(tx, {
      businessId,
      actorId: input.createdByUserId,
      action: "SUBSCRIPTION.CREATED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { invoiceId: invoice.id, amountMinor, currency, interval },
    });
    return {
      subscription: mapSubscription(subscription),
      invoice: mapInvoice(invoice),
    };
  });
}

export interface SubmitPaymentClaimInput {
  businessId: string;
  invoiceId: string;
  submittedById: string;
  amountMinor: number;
  currency: string;
  sentAt: Date | string;
  reference: string;
  note?: string;
  proofKey?: string;
  proofName?: string;
  proofMime?: string;
}

export interface PaymentClaimSubmissionDTO {
  claim: PaymentClaimDTO;
  wasAlreadySubmitted: boolean;
}

export async function submitPaymentClaim(
  input: SubmitPaymentClaimInput,
): Promise<PaymentClaimSubmissionDTO> {
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const invoiceId = assertNonEmpty(input.invoiceId, "Invoice id");
  const submittedById = assertNonEmpty(input.submittedById, "Submitter id");
  const reference = assertNonEmpty(input.reference, "Reference");
  const currency = normalizeCurrency(input.currency);
  const sentAt = toValidDate(input.sentAt, "Sent at");
  assertPositiveMinorUnits(input.amountMinor);

  return prisma.$transaction(async (tx: Tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) {
      throw new BillingNotFoundError("Invoice not found");
    }
    if (invoice.status === "PAID") {
      throw new BillingConflictError("Invoice is already paid");
    }
    if (input.amountMinor !== invoice.amountMinor || currency !== invoice.currency) {
      throw new BillingValidationError("Claim amount and currency must match the invoice");
    }
    const existing = await tx.paymentClaim.findFirst({
      where: { businessId, reference },
    });
    if (existing) {
      if (
        existing.invoiceId === invoiceId &&
        existing.amountMinor === input.amountMinor &&
        existing.currency === currency
      ) {
        return {
          claim: mapPaymentClaim(existing),
          wasAlreadySubmitted: true,
        };
      }
      throw new BillingConflictError("Reference is already used by another claim");
    }
    const claim = await tx.paymentClaim.create({
      data: {
        businessId,
        invoiceId,
        submittedById,
        amountMinor: input.amountMinor,
        currency,
        sentAt,
        reference,
        note: input.note ?? null,
        proofKey: input.proofKey ?? null,
        proofName: input.proofName ?? null,
        proofMime: input.proofMime ?? null,
        status: "SUBMITTED",
      },
    });
    await recordAudit(tx, {
      businessId,
      actorId: submittedById,
      action: "PAYMENT_CLAIM.SUBMITTED",
      entityType: "PaymentClaim",
      entityId: claim.id,
      metadata: { invoiceId, reference, amountMinor: input.amountMinor, currency },
    });
    return {
      claim: mapPaymentClaim(claim),
      wasAlreadySubmitted: false,
    };
  });
}

export interface MarkClaimUnderReviewInput {
  claimId: string;
  businessId: string;
  underReviewById: string;
}

export async function markClaimUnderReview(
  input: MarkClaimUnderReviewInput,
): Promise<PaymentClaimDTO> {
  const claimId = assertNonEmpty(input.claimId, "Claim id");
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const underReviewById = assertNonEmpty(input.underReviewById, "Reviewer id");

  return prisma.$transaction(async (tx: Tx) => {
    const claim = await tx.paymentClaim.findFirst({
      where: { id: claimId, businessId },
    });
    if (!claim) {
      throw new BillingNotFoundError("Payment claim not found");
    }
    if (claim.status === "CONFIRMED" || claim.status === "REJECTED" || claim.status === "CANCELLED") {
      throw new BillingConflictError("Claim cannot be marked under review in its current state");
    }
    if (claim.status === "UNDER_REVIEW" && claim.underReviewById === underReviewById) {
      return mapPaymentClaim(claim);
    }
    const updated = await tx.paymentClaim.update({
      where: { id: claimId },
      data: {
        status: "UNDER_REVIEW",
        underReviewById,
      },
    });
    await recordAudit(tx, {
      businessId,
      actorId: underReviewById,
      action: "PAYMENT_CLAIM.UNDER_REVIEW",
      entityType: "PaymentClaim",
      entityId: claimId,
    });
    return mapPaymentClaim(updated);
  });
}

export interface RejectPaymentClaimInput {
  claimId: string;
  businessId: string;
  reviewedById: string;
  reason: string;
}

export interface PaymentClaimRejectionDTO {
  claim: PaymentClaimDTO;
  notificationIds: string[];
}

export async function rejectPaymentClaim(
  input: RejectPaymentClaimInput,
): Promise<PaymentClaimRejectionDTO> {
  const claimId = assertNonEmpty(input.claimId, "Claim id");
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const reviewedById = assertNonEmpty(input.reviewedById, "Reviewer id");
  const reason = assertNonEmpty(input.reason, "Rejection reason");

  return prisma.$transaction(async (tx: Tx) => {
    const claim = await tx.paymentClaim.findFirst({
      where: { id: claimId, businessId },
    });
    if (!claim) {
      throw new BillingNotFoundError("Payment claim not found");
    }
    if (claim.status === "REJECTED" || claim.status === "CANCELLED") {
      return {
        claim: mapPaymentClaim(claim),
        notificationIds: [],
      };
    }
    if (claim.status === "CONFIRMED") {
      throw new BillingConflictError("Confirmed claim cannot be rejected");
    }
    const now = new Date();
    const updated = await tx.paymentClaim.update({
      where: { id: claimId },
      data: {
        status: "REJECTED",
        underReviewById: reviewedById,
        reviewedAt: now,
        decisionReason: reason,
      },
    });
    await recordAudit(tx, {
      businessId,
      actorId: reviewedById,
      action: "PAYMENT_CLAIM.REJECTED",
      entityType: "PaymentClaim",
      entityId: claimId,
      metadata: { reason },
    });
    const notificationIds = await notifyInAppMembers(tx, {
      businessId,
      type: "PAYMENT_REJECTED",
      title: "Payment claim rejected",
      message: `Payment claim ${updated.reference} was rejected. ${reason}`,
      marker: { kind: "PAYMENT_REJECTED", claimId, invoiceId: updated.invoiceId },
      now,
    });
    return {
      claim: mapPaymentClaim(updated),
      notificationIds,
    };
  });
}

export interface ConfirmClaimPaymentInput {
  claimId: string;
  businessId: string;
  adminMembershipId: string;
}

export interface PaymentConfirmationDTO {
  payment: PaymentDTO | null;
  claim: PaymentClaimDTO;
  invoice: InvoiceDTO;
  subscription: SubscriptionDTO;
  notificationsCreated: string[];
}

export async function confirmClaimPayment(
  input: ConfirmClaimPaymentInput,
): Promise<PaymentConfirmationDTO> {
  const claimId = assertNonEmpty(input.claimId, "Claim id");
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const adminMembershipId = assertNonEmpty(input.adminMembershipId, "Admin membership id");

  return prisma.$transaction(async (tx: Tx) => {
    const admin = await requireBillingAdmin(tx, adminMembershipId);
    const claim = await tx.paymentClaim.findFirst({
      where: { id: claimId, businessId },
    });
    if (!claim) {
      throw new BillingNotFoundError("Payment claim not found");
    }
    const invoice = await tx.invoice.findFirst({
      where: { id: claim.invoiceId, businessId },
    });
    if (!invoice) {
      throw new BillingNotFoundError("Invoice not found");
    }
    const subscription = await tx.subscription.findFirst({
      where: { businessId },
    });
    if (!subscription) {
      throw new BillingNotFoundError("Subscription not found");
    }
    const existingPayment = await tx.payment.findFirst({
      where: { businessId, invoiceId: invoice.id },
    });

    if (claim.status === "CONFIRMED" || invoice.status === "PAID") {
      const payment =
        existingPayment ??
        (await tx.payment.findFirst({ where: { claimId: claim.id, businessId } }));
      return {
        payment: payment ? mapPayment(payment) : null,
        claim: mapPaymentClaim(claim),
        invoice: mapInvoice(invoice),
        subscription: mapSubscription(subscription),
        notificationsCreated: [],
      };
    }

    if (claim.amountMinor !== invoice.amountMinor || claim.currency !== invoice.currency) {
      throw new BillingValidationError("Claim amount and currency must match the invoice");
    }
    if (claim.status !== "SUBMITTED" && claim.status !== "UNDER_REVIEW") {
      throw new BillingConflictError("Claim cannot be confirmed in its current state");
    }
    const duplicateReference = await tx.payment.findUnique({
      where: { reference: claim.reference },
    });
    if (duplicateReference) {
      throw new BillingConflictError("Payment reference already exists");
    }

    const now = new Date();
    const business = await tx.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new BillingNotFoundError("Business not found");
    }

    const receiptNumber = generateNumber("RCPT-");
    const payment = await tx.payment.create({
      data: {
        businessId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        claimId: claim.id,
        adminId: admin.id,
        amountMinor: claim.amountMinor,
        currency: claim.currency,
        reference: claim.reference,
        method: "MOMO",
        kind: "PAYMENT",
        status: "CONFIRMED",
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        receiptNumber,
        notes: `Payment for claim ${claim.reference}`,
        confirmedAt: now,
      },
    });

    const paid = await applyPaidPeriod(tx, {
      businessId,
      subscriptionId: subscription.id,
      invoicePeriodStart: invoice.periodStart,
      invoicePeriodEnd: invoice.periodEnd,
      interval: subscription.interval,
      now,
      reason: `Payment confirmed for invoice ${invoice.number}`,
      changedById: admin.userId,
      adminHold: business.adminHold,
      currentBusinessStatus: business.status,
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: now },
    });

    const confirmedClaim = await tx.paymentClaim.update({
      where: { id: claim.id },
      data: {
        status: "CONFIRMED",
        underReviewById: admin.userId,
        reviewedAt: now,
        decisionReason: "Payment confirmed",
      },
    });

    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action: "PAYMENT.CONFIRMED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { invoiceId: invoice.id, claimId: claim.id, reference: claim.reference },
    });
    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action:
        paid.previousStatus === "ACTIVE" ? "SUBSCRIPTION.EXTENDED" : "SUBSCRIPTION.ACTIVATED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { nextDueDate: paid.nextDueDate.toISOString() },
    });
    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action: "INVOICE.PAID",
      entityType: "Invoice",
      entityId: invoice.id,
    });

    const refreshedSubscription = await tx.subscription.findFirst({ where: { businessId } });
    const notificationIds = await notifyInAppMembers(tx, {
      businessId,
      type: "PAYMENT_CONFIRMED",
      title: "Payment confirmed",
      message: `Payment of ${claim.currency} ${(claim.amountMinor / 100).toFixed(2)} for invoice ${invoice.number} was confirmed.`,
      marker: { kind: "PAYMENT_CONFIRMED", claimId: claim.id, invoiceId: invoice.id },
      now,
    });

    return {
      payment: mapPayment(payment),
      claim: mapPaymentClaim(confirmedClaim),
      invoice: mapInvoice({ ...invoice, status: "PAID", paidAt: now }),
      subscription: mapSubscription(refreshedSubscription ?? paid.subscription),
      notificationsCreated: notificationIds,
    };
  });
}

export interface RecordManualPaymentInput {
  businessId: string;
  subscriptionId: string;
  invoiceId: string;
  adminMembershipId: string;
  amountMinor: number;
  currency: string;
  reference: string;
  notes?: string;
}

export interface ManualPaymentDTO {
  payment: PaymentDTO;
  invoice: InvoiceDTO;
  subscription: SubscriptionDTO;
  notificationsCreated: string[];
}

export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<ManualPaymentDTO> {
  const businessId = assertNonEmpty(input.businessId, "Business id");
  const subscriptionId = assertNonEmpty(input.subscriptionId, "Subscription id");
  const invoiceId = assertNonEmpty(input.invoiceId, "Invoice id");
  const adminMembershipId = assertNonEmpty(input.adminMembershipId, "Admin membership id");
  const reference = assertNonEmpty(input.reference, "Reference");
  const currency = normalizeCurrency(input.currency);
  assertPositiveMinorUnits(input.amountMinor);

  return prisma.$transaction(async (tx: Tx) => {
    const admin = await requireBillingAdmin(tx, adminMembershipId);
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId, subscriptionId },
    });
    if (!invoice) {
      throw new BillingNotFoundError("Invoice not found");
    }
    const subscription = await tx.subscription.findFirst({
      where: { id: subscriptionId, businessId },
    });
    if (!subscription) {
      throw new BillingNotFoundError("Subscription not found");
    }
    const existingPayment = await tx.payment.findFirst({
      where: { businessId, invoiceId: invoice.id },
    });
    if (invoice.status === "PAID" || existingPayment) {
      if (!existingPayment) {
        throw new BillingConflictError("Invoice is already paid");
      }
      return {
        payment: mapPayment(existingPayment),
        invoice: mapInvoice(invoice),
        subscription: mapSubscription(subscription),
        notificationsCreated: [],
      };
    }
    if (input.amountMinor !== invoice.amountMinor || currency !== invoice.currency) {
      throw new BillingValidationError("Manual payment amount and currency must match the invoice");
    }
    const claimedReference = await tx.paymentClaim.findFirst({
      where: { businessId, reference },
    });
    if (claimedReference) {
      throw new BillingConflictError("Reference is already used by a payment claim");
    }
    const duplicateReference = await tx.payment.findUnique({
      where: { reference },
    });
    if (duplicateReference) {
      throw new BillingConflictError("Payment reference already exists");
    }

    const now = new Date();
    const business = await tx.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new BillingNotFoundError("Business not found");
    }

    const receiptNumber = generateNumber("RCPT-");
    const payment = await tx.payment.create({
      data: {
        businessId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        claimId: null,
        adminId: admin.id,
        amountMinor: input.amountMinor,
        currency,
        reference,
        method: "MANUAL",
        kind: "PAYMENT",
        status: "CONFIRMED",
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        receiptNumber,
        notes: input.notes ?? null,
        confirmedAt: now,
      },
    });

    const paid = await applyPaidPeriod(tx, {
      businessId,
      subscriptionId: subscription.id,
      invoicePeriodStart: invoice.periodStart,
      invoicePeriodEnd: invoice.periodEnd,
      interval: subscription.interval,
      now,
      reason: `Manual payment recorded for invoice ${invoice.number}`,
      changedById: admin.userId,
      adminHold: business.adminHold,
      currentBusinessStatus: business.status,
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: now },
    });

    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action: "PAYMENT.MANUAL.RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { invoiceId: invoice.id, reference, amountMinor: input.amountMinor, currency },
    });
    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action:
        paid.previousStatus === "ACTIVE" ? "SUBSCRIPTION.EXTENDED" : "SUBSCRIPTION.ACTIVATED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { nextDueDate: paid.nextDueDate.toISOString() },
    });
    await recordAudit(tx, {
      businessId,
      actorId: admin.userId,
      action: "INVOICE.PAID",
      entityType: "Invoice",
      entityId: invoice.id,
    });

    const refreshedSubscription = await tx.subscription.findFirst({ where: { businessId } });
    const notificationIds = await notifyInAppMembers(tx, {
      businessId,
      type: "PAYMENT_CONFIRMED",
      title: "Payment confirmed",
      message: `A manual payment of ${currency} ${(input.amountMinor / 100).toFixed(2)} for invoice ${invoice.number} was recorded.`,
      marker: { kind: "PAYMENT_CONFIRMED", invoiceId: invoice.id, reference },
      now,
    });

    return {
      payment: mapPayment(payment),
      invoice: mapInvoice({ ...invoice, status: "PAID", paidAt: now }),
      subscription: mapSubscription(refreshedSubscription ?? paid.subscription),
      notificationsCreated: notificationIds,
    };
  });
}

export interface RunBillingTransitionsInput {
  now?: Date;
  gracePeriodDays?: number;
  approachingDueDays?: number;
  pastDuePauseDays?: number;
  reminderDays?: number[];
}

export interface BillingTransitionSummary {
  businessId: string;
  subscriptionId: string;
  fromStatus: StoredSubscriptionStatus;
  toStatus: StoredSubscriptionStatus;
  changed: boolean;
  graceEndsAt: string | null;
  isApproachingDue: boolean;
  reminderNotificationIds: string[];
}

export async function runBillingTransitions(
  input: RunBillingTransitionsInput = {},
): Promise<BillingTransitionSummary[]> {
  const now = input.now ?? new Date();
  const gracePeriodDays = input.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS;
  const approachingDueDays = input.approachingDueDays ?? DEFAULT_APPROACHING_DUE_DAYS;
  const pastDuePauseDays = input.pastDuePauseDays ?? DEFAULT_PAST_DUE_PAUSE_DAYS;
  const reminderDays = [...new Set(input.reminderDays ?? [7, 3, 1])].sort((a, b) => b - a);
  const options: SubscriptionStateOptions = { now, gracePeriodDays, approachingDueDays };

  return prisma.$transaction(async (tx: Tx) => {
    const subscriptions = await tx.subscription.findMany({
      where: { status: { in: ["PENDING_PAYMENT", "ACTIVE", "GRACE_PERIOD", "PAST_DUE"] } },
      include: { business: true },
    });

    const summaries: BillingTransitionSummary[] = [];

    for (const subscription of subscriptions) {
      const business = subscription.business;
      const plan = planSubscriptionTransition(
        {
          status: subscription.status,
          dueDate: subscription.dueDate,
          graceEndsAt: subscription.graceEndsAt,
          pausedAt: subscription.pausedAt,
          cancelledAt: subscription.cancelledAt,
        },
        options,
      );

      let toStatus: StoredSubscriptionStatus = subscription.status;
      let nextGraceEndsAt: Date | null = subscription.graceEndsAt ?? null;
      const pauseReason = business.pauseReason;
      const pauseNow =
        shouldPauseSubscription(plan.toStatus, subscription.dueDate, {
          now,
          pastDuePauseDays,
        }) && (plan.toStatus === "PAST_DUE" || plan.toStatus === "GRACE_PERIOD");

      if (pauseNow) {
        toStatus = "PAUSED";
        nextGraceEndsAt = null;
      } else if (plan.shouldTransition) {
        toStatus = plan.toStatus;
        nextGraceEndsAt = plan.graceEndsAt;
        if (toStatus === "PAST_DUE") {
          nextGraceEndsAt = null;
        }
      }

      const changed = toStatus !== subscription.status;

      if (changed) {
        if (toStatus === "GRACE_PERIOD") {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: "GRACE_PERIOD",
              graceEndsAt: nextGraceEndsAt,
            },
          });
          if (!business.adminHold && business.status !== "GRACE_PERIOD") {
            await tx.business.update({
              where: { id: business.id },
              data: { status: "GRACE_PERIOD" },
            });
          }
          await tx.subscriptionStatusHistory.create({
            data: {
              subscriptionId: subscription.id,
              fromStatus: subscription.status,
              toStatus: "GRACE_PERIOD",
              reason: plan.reason,
            },
          });
          await notifyInAppMembers(tx, {
            businessId: business.id,
            type: "GRACE_PERIOD",
            title: "Grace period started",
            message: "The billing grace period has started. Pay now to keep the account active.",
            marker: { kind: "GRACE_PERIOD", dueDate: subscription.dueDate.toISOString() },
            now,
          });
        } else if (toStatus === "PAST_DUE") {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: "PAST_DUE", graceEndsAt: null },
          });
          await tx.subscriptionStatusHistory.create({
            data: {
              subscriptionId: subscription.id,
              fromStatus: subscription.status,
              toStatus: "PAST_DUE",
              reason: plan.reason,
            },
          });
          await notifyInAppMembers(tx, {
            businessId: business.id,
            type: "PAYMENT_DUE",
            title: "Payment overdue",
            message: `Invoice for ${subscription.dueDate.toISOString()} is now past due.`,
            marker: {
              kind: "PAST_DUE",
              dueDate: subscription.dueDate.toISOString(),
            },
            now,
          });
        } else if (toStatus === "PAUSED") {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: "PAUSED", pausedAt: now, graceEndsAt: null },
          });
          if (!business.adminHold) {
            await tx.business.update({
              where: { id: business.id },
              data: { status: "PAUSED", pauseReason: pauseReason ?? "Payment overdue" },
            });
          }
          await tx.subscriptionStatusHistory.create({
            data: {
              subscriptionId: subscription.id,
              fromStatus: subscription.status,
              toStatus: "PAUSED",
              reason: "Payment overdue and subscription paused",
            },
          });
          await notifyInAppMembers(tx, {
            businessId: business.id,
            type: "ACCOUNT_PAUSED",
            title: "Account paused",
            message: "Your subscription was paused because the payment is overdue.",
            marker: { kind: "ACCOUNT_PAUSED", dueDate: subscription.dueDate.toISOString() },
            now,
          });
        }
      }

      const reminderNotificationIds: string[] = [];
      if (
        subscription.status !== "GRACE_PERIOD" &&
        subscription.status !== "PAST_DUE" &&
        subscription.dueDate.getTime() > now.getTime()
      ) {
        for (const reminderDay of reminderDays) {
          if (reminderDay < 0) {
            continue;
          }
          const windowStart = addDays(subscription.dueDate, -reminderDay).getTime();
          if (windowStart <= now.getTime()) {
            const ids = await notifyInAppMembers(tx, {
              businessId: business.id,
              type: "PAYMENT_DUE",
              title: "Payment due soon",
              message: `Your subscription payment is due on ${subscription.dueDate.toISOString()}.`,
              marker: {
                kind: "PAYMENT_DUE_REMINDER",
                dueDate: subscription.dueDate.toISOString(),
                reminderDay,
              },
              now,
            });
            reminderNotificationIds.push(...ids);
          }
        }
      }

      summaries.push({
        businessId: business.id,
        subscriptionId: subscription.id,
        fromStatus: subscription.status,
        toStatus,
        changed,
        graceEndsAt: nextGraceEndsAt ? nextGraceEndsAt.toISOString() : null,
        isApproachingDue: plan.isApproachingDue,
        reminderNotificationIds: reminderNotificationIds,
      });
    }

    return summaries;
  });
}

export function assertSubscriptionTransitionAllowed(
  fromStatus: StoredSubscriptionStatus,
  toStatus: StoredSubscriptionStatus,
): void {
  assertTransitionAllowed(fromStatus, toStatus);
}

export const createBusinessSubscriptionAndInvoice = createBusinessSubscription;
export const confirmPayment = confirmClaimPayment;
export const markClaimForReview = markClaimUnderReview;
export const applyBillingTransitions = runBillingTransitions;

export type { SubscriptionStatusInput, SubscriptionStateOptions };