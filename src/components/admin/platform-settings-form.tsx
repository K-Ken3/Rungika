"use client";

import { useActionState } from "react";

import { updatePlatformSettingsAction } from "@/actions/admin";
import { initialAdminActionState } from "@/components/admin/action-state";
import { ActionFeedback } from "@/components/admin/action-forms";
import {
  Button,
  CheckboxField,
  Field,
  Notice,
  SelectField,
  TextareaField,
} from "@/components/admin/ui";
import type { PlatformSettingsDTO } from "@/lib/data/platform-settings";

export function PlatformSettingsForm({
  settings,
  editable,
}: {
  settings: PlatformSettingsDTO;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePlatformSettingsAction, initialAdminActionState);
  if (!editable) {
    return (
      <Notice tone="info">
        Platform settings are visible in this workspace, but only a super administrator can change them.
      </Notice>
    );
  }

  return (
    <form action={formAction} className="space-y-8" aria-busy={pending}>
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-extrabold text-emerald-950">Plan and billing</h2>
          <p className="mt-1 text-sm text-slate-600">The platform stores all prices in minor units and never performs currency conversion.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Plan name" name="planName" defaultValue={settings.planName} required />
          <Field
            label="Price"
            name="priceMajor"
            type="number"
            defaultValue={(settings.priceMinor / 100).toFixed(2)}
            min="0.01"
            step="0.01"
            required
          />
          <Field label="Currency" name="currency" defaultValue={settings.currency} required hint="Three-letter ISO code." />
          <Field
            label="Payment currency"
            name="paymentCurrency"
            defaultValue={settings.paymentCurrency}
            required
            hint="Must match the configured currency; no fixed local amount exists in this schema."
          />
          <SelectField
            label="Billing interval"
            name="billingInterval"
            defaultValue={settings.billingInterval}
            options={[
              { value: "MONTH", label: "Monthly" },
              { value: "QUARTER", label: "Quarterly" },
              { value: "YEAR", label: "Yearly" },
            ]}
          />
          <Field label="Trial days" name="trialDays" type="number" defaultValue={settings.trialDays} min="0" max="365" required />
          <Field label="Grace period days" name="gracePeriodDays" type="number" defaultValue={settings.gracePeriodDays} min="0" max="365" required />
          <Field label="Claim review days" name="claimReviewDays" type="number" defaultValue={settings.claimReviewDays} min="0" max="365" required />
          <Field label="Reminder days" name="reminderDays" defaultValue={settings.reminderDays.join(", ")} required hint="Comma-separated whole numbers, for example 7, 3, 1." />
        </div>
      </section>

      <section className="space-y-5 border-t border-emerald-100 pt-8">
        <div>
          <h2 className="text-lg font-extrabold text-emerald-950">Mobile Money configuration</h2>
          <p className="mt-1 text-sm text-slate-600">Only non-secret instructions are displayed here. The QR storage key is write-only.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="MoMo provider" name="momoProvider" defaultValue={settings.momoProvider ?? ""} />
          <Field label="Recipient name" name="momoRecipientName" defaultValue={settings.momoRecipientName ?? ""} />
          <Field label="Merchant code" name="momoMerchantCode" defaultValue={settings.momoMerchantCode ?? ""} />
          <Field label="Country" name="momoCountry" defaultValue={settings.momoCountry ?? ""} />
          <Field
            label="QR storage key"
            name="momoQrKey"
            type="password"
            placeholder={settings.momoQrKeyConfigured ? "Configured; leave blank to keep it" : "Not configured"}
            hint="The current key is never sent back to the browser."
          />
          <Field label="Reference format" name="referenceFormat" defaultValue={settings.referenceFormat} required />
        </div>
        <TextareaField label="Payment instructions" name="paymentInstructions" defaultValue={settings.paymentInstructions ?? ""} rows={4} />
        <TextareaField label="Support contact" name="supportContact" defaultValue={settings.supportContact ?? ""} rows={3} />
      </section>

      <section className="space-y-5 border-t border-emerald-100 pt-8">
        <div>
          <h2 className="text-lg font-extrabold text-emerald-950">Policies and notifications</h2>
          <p className="mt-1 text-sm text-slate-600">These switches control application behavior; they do not claim that an external message was delivered.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CheckboxField label="Allow multiple businesses per owner" name="allowMultipleBusinesses" defaultChecked={settings.allowMultipleBusinesses} />
          <Field label="Maximum businesses per owner" name="maxBusinessesPerOwner" type="number" defaultValue={settings.maxBusinessesPerOwner} min="1" max="1000" required />
          <CheckboxField label="Email notifications enabled" name="emailNotificationsEnabled" defaultChecked={settings.emailNotificationsEnabled} />
          <CheckboxField label="SMS notifications enabled" name="smsNotificationsEnabled" defaultChecked={settings.smsNotificationsEnabled} />
        </div>
      </section>

      <div className="flex flex-col gap-4 border-t border-emerald-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <ActionFeedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving settings…" : "Save platform settings"}
        </Button>
      </div>
    </form>
  );
}
