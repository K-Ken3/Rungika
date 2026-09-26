"use client";

import type { ReactNode } from "react";
import type { BusinessActionState } from "@/actions/business";

export function ActionMessage({ state }: { state: BusinessActionState }) {
  if (!state.message) {
    return null;
  }
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-300 bg-emerald-100 text-emerald-800"
      }`}
    >
      {state.message}
    </p>
  );
}

export function ActionSubmitButton({
  pending,
  children,
  className = "",
  disabled = false,
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-emerald-950 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

const controlClass =
  "block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500";

export function TextField({
  id,
  label,
  error,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint}>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${controlClass} ${error ? "border-rose-400" : ""} ${className}`}
      />
    </FieldFrame>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint}>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${controlClass} ${error ? "border-rose-400" : ""} ${className}`}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint}>
      <textarea
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${controlClass} min-h-28 ${error ? "border-rose-400" : ""} ${className}`}
      />
    </FieldFrame>
  );
}

export function CheckboxField({
  id,
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          {...props}
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-emerald-200 bg-white text-emerald-700 focus:ring-emerald-500"
        />
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

function FieldFrame({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
