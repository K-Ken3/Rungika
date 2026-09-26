"use client";

import {
  addBusinessNoteAction,
  pauseBusinessAction,
  reactivateBusinessAction,
  setBusinessAdminHoldAction,
  updateSupportCaseStatusAction,
} from "@/actions/admin";
import { AdminActionForm, ConfirmActionForm } from "@/components/admin/action-forms";
import { Notice, SelectField, TextareaField } from "@/components/admin/ui";

function ReasonInput({ label = "Reason" }: { label?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="admin-action-reason" className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </label>
      <textarea
        id="admin-action-reason"
        name="reason"
        required
        rows={3}
        className="w-full resize-y rounded-xl border border-emerald-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}

export function BusinessControls({
  businessId,
  status,
  adminHold,
  canManage,
  canManageSupport,
}: {
  businessId: string;
  status: string;
  adminHold: boolean;
  canManage: boolean;
  canManageSupport: boolean;
}) {
  if (!canManage) {
    return (
      <Notice tone="info">
        Your administrator role can review this business but cannot change its operational status.
      </Notice>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {status !== "PAUSED" ? (
          <ConfirmActionForm
            action={pauseBusinessAction}
            title="Pause this business?"
            description="The business will be marked paused and the reason will be stored in its audit history. This does not cancel its subscription."
            confirmLabel="Pause business"
            triggerLabel="Pause business"
            fields={{ businessId }}
            tone="danger"
          >
            <ReasonInput label="Pause reason" />
          </ConfirmActionForm>
        ) : null}
        {status !== "ACTIVE" ? (
          <ConfirmActionForm
            action={reactivateBusinessAction}
            title="Reactivate this business?"
            description="The operational status will be set to active. Record the reason so the change remains explainable."
            confirmLabel="Reactivate business"
            triggerLabel="Reactivate business"
            fields={{ businessId }}
          >
            <ReasonInput label="Reactivation reason" />
          </ConfirmActionForm>
        ) : null}
        <ConfirmActionForm
          action={setBusinessAdminHoldAction}
          title={adminHold ? "Release the admin hold?" : "Place this business on admin hold?"}
          description={adminHold ? "Payments can resume following this administrative change." : "The hold remains separate from the business status and is recorded for review."}
          confirmLabel={adminHold ? "Release hold" : "Enable hold"}
          triggerLabel={adminHold ? "Release admin hold" : "Set admin hold"}
          fields={{ businessId, hold: adminHold ? "false" : "true" }}
          tone={adminHold ? "primary" : "danger"}
        >
          <ReasonInput label="Hold reason" />
        </ConfirmActionForm>
      </div>
      <AdminActionForm
        action={addBusinessNoteAction}
        submitLabel="Save internal note"
        hiddenFields={{ businessId }}
      >
        <TextareaField
          label="Internal-only note"
          name="body"
          required
          rows={4}
          hint="This note is visible only in the administrator workspace."
        />
      </AdminActionForm>
      {!canManageSupport ? (
        <Notice tone="info">Support case updates require a support or super administrator role.</Notice>
      ) : null}
    </div>
  );
}

export function SupportCaseControl({
  caseId,
  currentStatus,
  canManage,
}: {
  caseId: string;
  currentStatus: string;
  canManage: boolean;
}) {
  if (!canManage) {
    return null;
  }
  return (
    <details className="rounded-xl border border-emerald-100 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-extrabold text-slate-800">Update case status</summary>
      <div className="mt-4">
        <AdminActionForm
          action={updateSupportCaseStatusAction}
          submitLabel="Save case update"
          hiddenFields={{ caseId }}
        >
          <SelectField
            label="Case status"
            name="status"
            defaultValue={currentStatus}
            options={[
              { value: "OPEN", label: "Open" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
          <ReasonInput label="Internal update reason" />
        </AdminActionForm>
      </div>
    </details>
  );
}
