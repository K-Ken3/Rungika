"use server";

import { BillingInterval, SupportCaseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  confirmClaimPayment,
  markClaimUnderReview,
  recordManualPayment,
  rejectPaymentClaim,
} from "@/lib/data/billing";
import {
  addBusinessNote,
  AdminDataError,
  pauseBusiness,
  reactivateBusiness,
  requireActiveAdminMembership,
  setBusinessAdminHold,
  updateSupportCaseStatus,
} from "@/lib/data/admin";
import { db } from "@/lib/db";
import {
  getPlatformSettings,
  updatePlatformSettings as savePlatformSettings,
} from "@/lib/data/platform-settings";
import { requireAdmin } from "@/lib/auth/authorization";
import type { AdminActionState } from "@/components/admin/action-state";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, name: string): boolean {
  const value = formValue(formData, name);
  return value === "on" || value === "true" || value === "1";
}

function formInteger(formData: FormData, name: string, label: string): number {
  const value = formValue(formData, name).trim();
  if (!value) {
    throw new AdminDataError(`${label} is required`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AdminDataError(`${label} must be a whole number`);
  }
  return parsed;
}

function formText(formData: FormData, name: string, label: string): string {
  const value = formValue(formData, name).trim();
  if (!value) {
    throw new AdminDataError(`${label} is required`);
  }
  return value;
}

function formOptionalText(formData: FormData, name: string): string | null {
  return formValue(formData, name).trim() || null;
}

function actionError(error: unknown): AdminActionState {
  if (error instanceof AdminDataError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Error && error.message) {
    if (
      error.message.includes("must") ||
      error.message.includes("Invalid") ||
      error.message.includes("already") ||
      error.message.includes("not found") ||
      error.message.includes("cannot") ||
      error.message.includes("required")
    ) {
      return { status: "error", message: error.message };
    }
  }
  return { status: "error", message: "The administrator action could not be completed." };
}

function actionSuccess(message: string): AdminActionState {
  return { status: "success", message };
}

function revalidateAdmin(businessId?: string): void {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/businesses");
  if (businessId) {
    revalidatePath(`/super-admin/businesses/${businessId}`);
  }
  revalidatePath("/super-admin/payments");
  revalidatePath("/super-admin/payment-history");
  revalidatePath("/super-admin/audit");
  revalidatePath("/super-admin/platform-settings");
}

function parseBillingInterval(value: string): BillingInterval {
  if (value === "MONTH" || value === "QUARTER" || value === "YEAR") {
    return value;
  }
  throw new AdminDataError("Billing interval is invalid");
}

function parseReminderDays(value: string): number[] {
  const parts = value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    throw new AdminDataError("Enter at least one reminder day");
  }
  return parts.map((part) => {
    const day = Number(part);
    if (!Number.isInteger(day) || day < 0 || day > 365) {
      throw new AdminDataError("Reminder days must be whole numbers between 0 and 365");
    }
    return day;
  });
}

async function findClaimBusinessId(claimId: string): Promise<string> {
  const claim = await db.paymentClaim.findUnique({
    where: { id: claimId },
    select: { businessId: true },
  });
  if (!claim) {
    throw new AdminDataError("Payment claim not found");
  }
  return claim.businessId;
}

export async function pauseBusinessAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const businessId = formText(formData, "businessId", "Business");
  const reason = formText(formData, "reason", "Pause reason");
  try {
    await pauseBusiness(admin, businessId, reason);
    revalidateAdmin(businessId);
    return actionSuccess("Business paused and the reason was recorded.");
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateBusinessAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const businessId = formText(formData, "businessId", "Business");
  const reason = formText(formData, "reason", "Reactivation reason");
  try {
    await reactivateBusiness(admin, businessId, reason);
    revalidateAdmin(businessId);
    return actionSuccess("Business reactivated and the reason was recorded.");
  } catch (error) {
    return actionError(error);
  }
}

export async function setBusinessAdminHoldAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const businessId = formText(formData, "businessId", "Business");
  const hold = formBoolean(formData, "hold");
  const reason = formText(formData, "reason", "Hold reason");
  try {
    await setBusinessAdminHold(admin, businessId, hold, reason);
    revalidateAdmin(businessId);
    return actionSuccess(hold ? "Admin hold enabled." : "Admin hold released.");
  } catch (error) {
    return actionError(error);
  }
}

export async function addBusinessNoteAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const businessId = formText(formData, "businessId", "Business");
  const body = formText(formData, "body", "Note");
  try {
    await addBusinessNote(admin, businessId, body);
    revalidateAdmin(businessId);
    return actionSuccess("Internal note saved.");
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSupportCaseStatusAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const caseId = formText(formData, "caseId", "Support case");
  const statusValue = formValue(formData, "status");
  if (![SupportCaseStatus.OPEN, SupportCaseStatus.IN_PROGRESS, SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(statusValue as SupportCaseStatus)) {
    throw new AdminDataError("Support case status is invalid");
  }
  const reason = formText(formData, "reason", "Support update reason");
  try {
    await updateSupportCaseStatus(admin, caseId, statusValue as SupportCaseStatus, reason);
    revalidateAdmin();
    return actionSuccess("Support case updated.");
  } catch (error) {
    return actionError(error);
  }
}

export async function markClaimUnderReviewAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const claimId = formText(formData, "claimId", "Payment claim");
  try {
    const businessId = await findClaimBusinessId(claimId);
    await markClaimUnderReview({ claimId, businessId, underReviewById: admin.userId });
    revalidateAdmin(businessId);
    return actionSuccess("Payment claim moved to under review.");
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmPaymentClaimAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const claimId = formText(formData, "claimId", "Payment claim");
  if (formValue(formData, "confirmed") !== "true") {
    return { status: "error", message: "Explicit confirmation is required before a payment can be confirmed." };
  }
  try {
    const businessId = await findClaimBusinessId(claimId);
    await confirmClaimPayment({ claimId, businessId, adminMembershipId: admin.id });
    revalidateAdmin(businessId);
    return actionSuccess("Payment confirmed and the invoice was marked paid.");
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectPaymentClaimAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const claimId = formText(formData, "claimId", "Payment claim");
  const reason = formText(formData, "reason", "Rejection reason");
  try {
    const businessId = await findClaimBusinessId(claimId);
    await rejectPaymentClaim({ claimId, businessId, reviewedById: admin.userId, reason });
    revalidateAdmin(businessId);
    return actionSuccess("Payment claim rejected and the business was notified in-app.");
  } catch (error) {
    return actionError(error);
  }
}

export async function recordManualPaymentAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const invoiceId = formText(formData, "invoiceId", "Open invoice");
  const reference = formText(formData, "reference", "Payment reference");
  const notes = formOptionalText(formData, "notes");
  try {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, status: { in: ["OPEN", "OVERDUE"] }, payment: null },
      select: { id: true, businessId: true, subscriptionId: true, amountMinor: true, currency: true },
    });
    if (!invoice) {
      throw new AdminDataError("The selected invoice is no longer open");
    }
    await recordManualPayment({
      businessId: invoice.businessId,
      subscriptionId: invoice.subscriptionId,
      invoiceId: invoice.id,
      adminMembershipId: admin.id,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      reference,
      notes: notes ?? undefined,
    });
    revalidateAdmin(invoice.businessId);
    return actionSuccess("Manual payment recorded and the invoice was marked paid.");
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePlatformSettingsAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  try {
    const priceMajor = Number(formValue(formData, "priceMajor").trim());
    if (!Number.isFinite(priceMajor)) {
      throw new AdminDataError("Price must be a valid number");
    }
    const reminderValue = formValue(formData, "reminderDays");
    await savePlatformSettings(admin, {
      planName: formText(formData, "planName", "Plan name"),
      priceMajor,
      currency: formValue(formData, "currency"),
      paymentCurrency: formValue(formData, "paymentCurrency"),
      billingInterval: parseBillingInterval(formValue(formData, "billingInterval")),
      trialDays: formInteger(formData, "trialDays", "Trial days"),
      gracePeriodDays: formInteger(formData, "gracePeriodDays", "Grace period days"),
      claimReviewDays: formInteger(formData, "claimReviewDays", "Claim review days"),
      reminderDays: parseReminderDays(reminderValue),
      momoProvider: formOptionalText(formData, "momoProvider"),
      momoRecipientName: formOptionalText(formData, "momoRecipientName"),
      momoMerchantCode: formOptionalText(formData, "momoMerchantCode"),
      momoCountry: formOptionalText(formData, "momoCountry"),
      momoQrKey: formOptionalText(formData, "momoQrKey") ?? undefined,
      paymentInstructions: formOptionalText(formData, "paymentInstructions"),
      supportContact: formOptionalText(formData, "supportContact"),
      allowMultipleBusinesses: formBoolean(formData, "allowMultipleBusinesses"),
      maxBusinessesPerOwner: formInteger(formData, "maxBusinessesPerOwner", "Maximum businesses per owner"),
      emailNotificationsEnabled: formBoolean(formData, "emailNotificationsEnabled"),
      smsNotificationsEnabled: formBoolean(formData, "smsNotificationsEnabled"),
      referenceFormat: formText(formData, "referenceFormat", "Reference format"),
    });
    revalidatePath("/super-admin/platform-settings");
    revalidatePath("/super-admin");
    return actionSuccess("Platform settings updated and the change was audited.");
  } catch (error) {
    return actionError(error);
  }
}

export async function getPlatformSettingsAction(): Promise<Awaited<ReturnType<typeof getPlatformSettings>>> {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  return getPlatformSettings(admin);
}
