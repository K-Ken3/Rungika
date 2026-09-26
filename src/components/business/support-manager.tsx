"use client";

import { useActionState } from "react";
import {
  createSupportCaseAction,
  initialBusinessActionState,
  updateSupportCaseAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";

type SupportCase = {
  id: string;
  subject: string;
  message: string;
  status: string;
  reporterName: string;
  createdAt: string;
  updatedAt: string;
};

export function SupportManager({
  businessId,
  cases,
  contact,
}: {
  businessId: string;
  cases: SupportCase[];
  contact: string | null;
}) {
  const [state, action, pending] = useActionState(
    createSupportCaseAction.bind(null, businessId),
    initialBusinessActionState,
  );
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-emerald-100 bg-white p-5">
        <h2 className="text-lg font-semibold text-emerald-950">Open a support case</h2>
        <p className="mt-2 text-sm text-slate-600">
          {contact ? `Configured support contact: ${contact}` : "No support contact is configured yet."}
        </p>
        <form action={action} className="mt-5 space-y-5" aria-busy={pending}>
          <TextField id="support-subject" name="subject" label="Subject" required error={state.fieldErrors?.subject?.[0]} />
          <TextAreaField id="support-message" name="message" label="How can we help?" required error={state.fieldErrors?.message?.[0]} />
          <ActionMessage state={state} />
          <ActionSubmitButton pending={pending}>Submit support case</ActionSubmitButton>
        </form>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-emerald-950">Your cases ({cases.length})</h2>
        {cases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
            No support cases have been submitted.
          </p>
        ) : (
          cases.map((supportCase) => (
            <SupportCaseRow key={supportCase.id} businessId={businessId} supportCase={supportCase} />
          ))
        )}
      </section>
    </div>
  );
}

function SupportCaseRow({
  businessId,
  supportCase,
}: {
  businessId: string;
  supportCase: SupportCase;
}) {
  const [state, action, pending] = useActionState(
    updateSupportCaseAction.bind(null, businessId),
    initialBusinessActionState,
  );
  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold text-emerald-950">{supportCase.subject}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {supportCase.reporterName} · opened {new Date(supportCase.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-slate-700">
          {supportCase.status}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{supportCase.message}</p>
      {supportCase.status !== "CLOSED" && supportCase.status !== "RESOLVED" ? (
        <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2" aria-busy={pending}>
          <input type="hidden" name="caseId" value={supportCase.id} />
          <input type="hidden" name="subject" value={supportCase.subject} />
          <input type="hidden" name="message" value={supportCase.message} />
          <SelectField id={`${supportCase.id}-status`} name="status" label="Update status" defaultValue={supportCase.status}>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </SelectField>
          <div className="flex items-end">
            <ActionSubmitButton pending={pending}>Save status</ActionSubmitButton>
          </div>
          <div className="sm:col-span-2">
            <ActionMessage state={state} />
          </div>
        </form>
      ) : null}
    </article>
  );
}
