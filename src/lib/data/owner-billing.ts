import "server-only";

import { db } from "@/lib/db";
import {
  assertBusinessPermission,
  BusinessAccessError,
  BusinessValidationError,
  getBusinessAccess,
  requireAccessibleBusiness,
} from "@/lib/data/business";
import {
  submitPaymentClaim,
  type InvoiceDTO,
  type PaymentClaimDTO,
  type PaymentDTO,
  type SubscriptionDTO,
} from "@/lib/data/billing";
import { billingRestrictionDate } from "@/components/business/rules";
import {
  removePrivateUpload,
  savePrivateUpload,
  type PrivateUploadMetadata,
} from "@/lib/storage/private-upload";
import type { BillingInterval } from "@/lib/billing";

export interface OwnerBillingHistoryDTO {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface OwnerBillingDTO {
  businessStatus: string;
  subscription: SubscriptionDTO;
  invoices: InvoiceDTO[];
  claims: PaymentClaimDTO[];
  receipts: PaymentDTO[];
  history: OwnerBillingHistoryDTO[];
  settings: {
    trialDays: number;
    gracePeriodDays: number;
    claimReviewDays: number;
    paymentCurrency: string;
    referenceFormat: string;
    momoProvider: string | null;
    momoRecipientName: string | null;
    momoMerchantCode: string | null;
    momoCountry: string | null;
    paymentInstructions: string | null;
    qrConfigured: boolean;
  };
  restrictionDate: string | null;
  currencyMismatch: {
    present: boolean;
    invoiceCurrency: string;
    paymentCurrency: string;
    message: string | null;
  };
}

function mapSubscription(value: {
  id: string;
  businessId: string;
  planId: string | null;
  planNameSnapshot: string;
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  status: "PENDING_PAYMENT" | "ACTIVE" | "GRACE_PERIOD" | "PAST_DUE" | "PAUSED" | "CANCELLED";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  dueDate: Date;
  graceEndsAt: Date | null;
  pausedAt: Date | null;
  cancelledAt: Date | null;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SubscriptionDTO {
  return {
    ...value,
    currentPeriodStart: value.currentPeriodStart.toISOString(),
    currentPeriodEnd: value.currentPeriodEnd.toISOString(),
    dueDate: value.dueDate.toISOString(),
    graceEndsAt: value.graceEndsAt?.toISOString() ?? null,
    pausedAt: value.pausedAt?.toISOString() ?? null,
    cancelledAt: value.cancelledAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapInvoice(value: {
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
}): InvoiceDTO {
  return {
    ...value,
    periodStart: value.periodStart.toISOString(),
    periodEnd: value.periodEnd.toISOString(),
    dueDate: value.dueDate.toISOString(),
    paidAt: value.paidAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapClaim(value: {
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
}): PaymentClaimDTO {
  return {
    ...value,
    proofAvailable: Boolean(value.proofKey),
    sentAt: value.sentAt.toISOString(),
    reviewedAt: value.reviewedAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapPayment(value: {
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
}): PaymentDTO {
  return {
    ...value,
    periodStart: value.periodStart.toISOString(),
    periodEnd: value.periodEnd.toISOString(),
    confirmedAt: value.confirmedAt.toISOString(),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

export async function getOwnerBilling(
  userId: string,
  businessId: string,
): Promise<OwnerBillingDTO> {
  const access = await requireAccessibleBusiness(userId, businessId, "billing.view");
  const [subscription, invoices, claims, receipts, history, setting] = await Promise.all([
    db.subscription.findFirst({
      where: {
        businessId,
        business: { memberships: { some: { userId, status: "ACTIVE" } } },
      },
    }),
    db.invoice.findMany({
      where: {
        businessId,
        business: { memberships: { some: { userId, status: "ACTIVE" } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.paymentClaim.findMany({
      where: {
        businessId,
        business: { memberships: { some: { userId, status: "ACTIVE" } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.payment.findMany({
      where: {
        businessId,
        business: { memberships: { some: { userId, status: "ACTIVE" } } },
      },
      orderBy: { confirmedAt: "desc" },
    }),
    db.subscriptionStatusHistory.findMany({
      where: {
        subscription: {
          businessId,
          business: { memberships: { some: { userId, status: "ACTIVE" } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.platformSetting.findUnique({ where: { id: "default" } }),
  ]);
  if (!subscription) {
    throw new BusinessValidationError("This business does not have a subscription.");
  }
  const paymentCurrency = (setting?.paymentCurrency ?? subscription.currency).toUpperCase();
  const mismatch = paymentCurrency !== subscription.currency.toUpperCase();
  const mappedSubscription = mapSubscription(subscription);
  return {
    subscription: mappedSubscription,
    invoices: invoices.map(mapInvoice),
    claims: claims.map(mapClaim),
    receipts: receipts.map(mapPayment),
    history: history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
    settings: {
      trialDays: setting?.trialDays ?? 0,
      gracePeriodDays: setting?.gracePeriodDays ?? 3,
      claimReviewDays: setting?.claimReviewDays ?? 5,
      paymentCurrency,
      referenceFormat: setting?.referenceFormat ?? "RUNGIKA-{BUSINESS}-{DUE_DATE}",
      momoProvider: setting?.momoProvider ?? null,
      momoRecipientName: setting?.momoRecipientName ?? null,
      momoMerchantCode: setting?.momoMerchantCode ?? null,
      momoCountry: setting?.momoCountry ?? null,
      paymentInstructions: setting?.paymentInstructions ?? null,
      qrConfigured: Boolean(setting?.momoQrKey),
    },
    restrictionDate: ["PENDING_PAYMENT", "PAST_DUE", "PAUSED", "CANCELLED"].includes(
      subscription.status,
    )
      ? billingRestrictionDate({
          dueDate: subscription.dueDate.toISOString(),
          graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
        })
      : null,
    currencyMismatch: {
      present: mismatch,
      invoiceCurrency: subscription.currency,
      paymentCurrency,
      message: mismatch
        ? `The configured payment currency is ${paymentCurrency}, while this invoice is in ${subscription.currency}. No exchange rate is configured, so payment cannot be claimed until an administrator resolves the mismatch.`
        : null,
    },
    businessStatus: access.business.status,
  };
}

export async function submitOwnerPaymentClaim(input: {
  userId: string;
  businessId: string;
  invoiceId: string;
  reference: string;
  sentAt: Date;
  note?: string;
  proof?: File;
}) {
  await assertBusinessPermission(input.userId, input.businessId, "billing.manage_billing");
  const access = await getBusinessAccess(input.userId, input.businessId);
  if (access.role !== "OWNER") {
    throw new BusinessAccessError("Only a business owner can submit a payment claim.");
  }
  const invoice = await db.invoice.findFirst({
    where: {
      id: input.invoiceId,
      businessId: input.businessId,
      business: { memberships: { some: { userId: input.userId, status: "ACTIVE" } } },
    },
  });
  if (!invoice) {
    throw new BusinessValidationError("The invoice does not exist.");
  }
  if (invoice.status === "PAID") {
    throw new BusinessValidationError("This invoice is already paid.");
  }
  const setting = await db.platformSetting.findUnique({ where: { id: "default" } });
  const paymentCurrency = (setting?.paymentCurrency ?? invoice.currency).toUpperCase();
  if (paymentCurrency !== invoice.currency.toUpperCase()) {
    throw new BusinessValidationError(
      `Payment currency ${paymentCurrency} does not match invoice currency ${invoice.currency}. No exchange rate is configured.`,
    );
  }
  let proof: PrivateUploadMetadata | null = null;
  if (input.proof) {
    try {
      proof = await savePrivateUpload(input.proof);
    } catch {
      throw new BusinessValidationError(
        "The proof file is not an accepted PNG, JPEG, WEBP, or PDF file of 5 MB or less.",
      );
    }
  }
  try {
    return await submitPaymentClaim({
      businessId: input.businessId,
      invoiceId: invoice.id,
      submittedById: input.userId,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      sentAt: input.sentAt,
      reference: input.reference,
      note: input.note,
      proofKey: proof?.key,
      proofName: proof?.name,
      proofMime: proof?.mime,
    });
  } catch (error) {
    if (proof) {
      try {
        await removePrivateUpload(proof.key);
      } catch {
        void 0;
      }
    }
    throw error;
  }
}
