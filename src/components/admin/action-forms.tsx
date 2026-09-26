"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { initialAdminActionState, type AdminActionState } from "@/components/admin/action-state";
import { Button } from "@/components/admin/ui";

export type AdminServerAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

export function ActionFeedback({ state }: { state: AdminActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-xl border px-3 py-2 text-sm ${
        state.status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.message}
    </p>
  );
}

export function AdminActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  hiddenFields = {},
  variant = "primary",
  className = "",
}: {
  action: AdminServerAction;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  hiddenFields?: Record<string, string>;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialAdminActionState);
  return (
    <form action={formAction} className={`space-y-3 ${className}`} aria-busy={pending}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <ActionFeedback state={state} />
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

export function ConfirmActionForm({
  action,
  title,
  description,
  confirmLabel,
  triggerLabel,
  fields,
  children,
  tone = "primary",
}: {
  action: AdminServerAction;
  title: string;
  description: string;
  confirmLabel: string;
  triggerLabel: string;
  fields: Record<string, string>;
  children?: React.ReactNode;
  tone?: "primary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, initialAdminActionState);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-${title.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <Button type="button" variant={tone} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-description`}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-emerald-100 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-white/80"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="p-6 sm:p-8">
          <h2 id={titleId} className="text-xl font-extrabold text-emerald-950">
            {title}
          </h2>
          <p id={`${titleId}-description`} className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </p>
          <form action={formAction} className="mt-6 space-y-4" aria-busy={pending}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {children}
            <ActionFeedback state={state} />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant={tone} name="confirmed" value="true" disabled={pending}>
                {pending ? "Working…" : confirmLabel}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
