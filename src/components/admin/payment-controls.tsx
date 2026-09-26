"use client";

import {
  confirmPaymentClaimAction,
  markClaimUnderReviewAction,
  recordManualPaymentAction,
  rejectPaymentClaimAction,
} from "@/actions/admin";
import { AdminActionForm, ConfirmActionForm } from "@/components/admin/action-forms";
import { Notice, SelectField, TextareaField } from "@/components/admin/ui";
import type { OpenInvoiceOption, PaymentClaimQueueItem } from "@/lib/data/admin";

function RejectionReason() {
  return (
    <div className="space-y-1.5">
      <label htmlFor="claim-rejection-reason" className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
        Rejection reason
      </label>
      <textarea
        id="claim-rejection-reason"
        name="reason"
        required
        rows={3}
        className="w-full resize-y rounded-xl border border-emerald-100 px-3 py-2.5 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
      />
    </div>
  );
}

export function PaymentClaimActions({
  claim,
  canManagePayments,
}: {
  claim: PaymentClaimQueueItem;
  canManagePayments: boolean;
}) {
  if (!canManagePayments) {
    return <Notice tone="info">Payment decisions require a finance or super administrator role.</Notice>;
  }

  return (
    <div className="space-y-4">
      {claim.status === "SUBMITTED" ? (
        <AdminActionForm
          action={markClaimUnderReviewAction}
          submitLabel="Mark under review"
          pendingLabel="Updating…"
          hiddenFields={{ claimId: claim.id }}
          variant="secondary"
        />
      ) : null}
      {claim.status === "UNDER_REVIEW" ? (
        <div className="flex flex-wrap gap-3">
          <ConfirmActionForm
            action={confirmPaymentClaimAction}
            title="Confirm this payment?"
            description="This creates a payment record, marks the invoice paid, advances the subscription, and records the administrator decision. It cannot be undone from this screen."
            confirmLabel="Confirm payment"
            triggerLabel="Confirm payment"
            fields={{ claimId: claim.id }}
          >
            {claim.duplicateReference ? (
              <Notice tone="error">
                This reference is already associated with another claim or payment. Confirmation will be rejected if the duplicate remains.
              </Notice>
            ) : null}
          </ConfirmActionForm>
          <ConfirmActionForm
            action={rejectPaymentClaimAction}
            title="Reject this payment claim?"
            description="The business will receive an in-app rejection notification containing the reason."
            confirmLabel="Reject claim"
            triggerLabel="Reject claim"
            fields={{ claimId: claim.id }}
            tone="danger"
          >
            <RejectionReason />
          </ConfirmActionForm>
        </div>
      ) : (
        <AdminActionForm
          action={rejectPaymentClaimAction}
          submitLabel="Reject claim"
          hiddenFields={{ claimId: claim.id }}
          variant="danger"
        >
          <RejectionReason />
        </AdminActionForm>
      )}
    </div>
  );
}

export function ManualPaymentForm({
  options,
  canManagePayments,
}: {
  options: OpenInvoiceOption[];
  canManagePayments: boolean;
}) {
  if (!canManagePayments) {
    return <Notice tone="info">Manual payment recording requires a finance or super administrator role.</Notice>;
  }
  return (
    <AdminActionForm
      action={recordManualPaymentAction}
      submitLabel="Record manual payment"
      pendingLabel="Recording…"
      variant="secondary"
    >
      <SelectField
        label="Open invoice"
        name="invoiceId"
        required
        options={[
          { value: "", label: options.length ? "Select an open invoice" : "No open invoices available" },
          ...options.map((option) => ({
            value: option.invoiceId,
            label: `${option.businessName} · ${option.invoiceNumber} · ${option.currency} ${(option.amountMinor / 100).toFixed(2)} · due ${new Date(option.dueDate).toLocaleDateString()}`,
          })),
        ]}
      />
      <TextareaField
        label="Internal payment notes"
        name="notes"
        rows={3}
        hint="Optional context stored with the payment record."
      />
      <div className="space-y-1.5">
        <label htmlFor="manual-payment-reference" className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
          Payment reference
        </label>
        <input
          id="manual-payment-reference"
          name="reference"
          required
          maxLength={120}
          className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      {options.length === 0 ? <Notice tone="warning">There are no open or overdue invoices available for manual recording.</Notice> : null}
    </AdminActionForm>
  );
}
