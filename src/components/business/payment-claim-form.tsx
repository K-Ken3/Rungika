"use client";

import { useActionState } from "react";
import {
  initialBusinessActionState,
  submitPaymentClaimAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";

type Invoice = {
  id: string;
  number: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  status: string;
};

export function PaymentClaimForm({
  businessId,
  invoices,
  instructions,
  currencyMismatch,
}: {
  businessId: string;
  invoices: Invoice[];
  instructions: string | null;
  currencyMismatch: string | null;
}) {
  const [state, action, pending] = useActionState(
    submitPaymentClaimAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const defaultSentAt = new Date().toISOString().slice(0, 16);

  return (
    <form action={action} className="space-y-5 rounded-xl border border-emerald-100 bg-white p-5" aria-busy={pending}>
      {currencyMismatch ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {currencyMismatch}
        </p>
      ) : null}
      {instructions ? (
        <div className="rounded-lg border border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">Configured payment instructions</p>
          <p className="mt-1 whitespace-pre-wrap">{instructions}</p>
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField id="claim-invoice" name="invoiceId" label="Invoice" defaultValue={invoices[0]?.id ?? ""} disabled={invoices.length === 0}>
          {invoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>
              {invoice.number} · {invoice.currency} {(invoice.amountMinor / 100).toFixed(2)} · due {invoice.dueDate.slice(0, 10)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="claim-reference"
          name="reference"
          label="MoMo reference"
          required
          error={state.fieldErrors?.reference?.[0]}
        />
        <TextField
          id="claim-sent-at"
          name="sentAt"
          type="datetime-local"
          label="Payment sent at"
          defaultValue={defaultSentAt}
          required
          error={state.fieldErrors?.sentAt?.[0]}
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <label htmlFor="claim-proof" className="font-medium">
            Proof file (optional)
          </label>
          <input id="claim-proof" name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-2 block w-full text-sm" />
          <p className="mt-2 text-xs text-amber-800/80">
            Optional proof is stored privately and is only visible to your business and authorized Super Admin reviewers.
          </p>
        </div>
      </div>
      <TextAreaField id="claim-note" name="note" label="Payment note" error={state.fieldErrors?.note?.[0]} />
      <ActionMessage state={state} />
      <ActionSubmitButton pending={pending} disabled={invoices.length === 0 || Boolean(currencyMismatch)}>
        Submit payment claim
      </ActionSubmitButton>
    </form>
  );
}
