import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/billing";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({
  children,
  className = "",
  as: Component = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Component className={`rounded-2xl border border-emerald-100 bg-white shadow-sm ${className}`}>
      {children}
    </Component>
  );
}

export function PanelHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-emerald-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h2 className="text-base font-extrabold text-emerald-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "success" | "warning" | "danger";
  href?: string;
}) {
  const toneClasses = {
    default: "border-emerald-100 bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
  } as const;
  const content = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-emerald-950">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}
    </>
  );
  const className = `block rounded-2xl border p-5 shadow-sm transition ${toneClasses[tone]} ${
    href ? "hover:-translate-y-0.5 hover:shadow-md" : ""
  }`;
  return href ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

const badgeTones: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  SENT: "bg-emerald-100 text-emerald-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-violet-100 text-violet-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  OPEN: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-orange-100 text-orange-800",
  GRACE_PERIOD: "bg-amber-100 text-amber-800",
  UPCOMING_DUE: "bg-amber-100 text-amber-800",
  PENDING: "bg-emerald-50 text-slate-700",
  PAUSED: "bg-emerald-50 text-slate-800",
  REJECTED: "bg-rose-100 text-rose-800",
  FAILED: "bg-rose-100 text-rose-800",
  SKIPPED: "bg-emerald-50 text-slate-700",
  REVERSED: "bg-rose-100 text-rose-800",
  VOID: "bg-emerald-50 text-slate-700",
  OVERDUE: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-emerald-50 text-slate-700",
  CLOSED: "bg-emerald-50 text-slate-700",
};

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.replaceAll("_", " ").toLowerCase();
  const label = value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${badgeTones[value] ?? "bg-emerald-50 text-slate-700"}`}>
      {label || normalized}
    </span>
  );
}

export function AdminTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-600">{children}</thead>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-t border-emerald-100 align-top ${className}`}>{children}</tr>;
}

export function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-4 text-slate-700 sm:px-6 ${className}`}>{children}</td>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-bold text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error" | "warning";
}) {
  const classes = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  } as const;
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes[tone]}`}>{children}</div>;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  );
}

export function Money({ amountMinor, currency }: { amountMinor: number; currency: string }) {
  let formatted: string;
  try {
    formatted = formatMoney(amountMinor, currency);
  } catch {
    formatted = `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
  return <>{formatted}</>;
}

export function DateText({ value, withTime = false }: { value: string | null; withTime?: boolean }) {
  if (!value) {
    return <span className="text-slate-600">—</span>;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-slate-600">—</span>;
  }
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(date)}
    </time>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) {
    return null;
  }
  const href = (targetPage: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(targetPage));
    return `${basePath}?${search.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between gap-4 border-t border-emerald-100 px-5 py-4 text-sm sm:px-6" aria-label="Pagination">
      {page > 1 ? (
        <a className="font-bold text-emerald-700 hover:text-emerald-900" href={href(page - 1)}>
          Previous
        </a>
      ) : (
        <span className="text-slate-600">Previous</span>
      )}
      <span className="text-slate-600">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <a className="font-bold text-emerald-700 hover:text-emerald-900" href={href(page + 1)}>
          Next
        </a>
      ) : (
        <span className="text-slate-600">Next</span>
      )}
    </nav>
  );
}

export function SearchForm({
  action,
  children,
  className = "",
}: {
  action: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} method="get" className={`grid gap-3 ${className}`}>
      {children}
    </form>
  );
}

export function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  placeholder,
  required = false,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  hint?: string;
}) {
  const id = `admin-field-${name.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue = "",
  options,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  const id = `admin-field-${name.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextareaField({
  label,
  name,
  defaultValue = "",
  required = false,
  rows = 4,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
}) {
  const id = `admin-field-${name.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        rows={rows}
        className="w-full resize-y rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked = false,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const id = `admin-field-${name.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-slate-50 p-3">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-emerald-700" />
      <div>
        <label htmlFor={id} className="text-sm font-bold text-slate-800">
          {label}
        </label>
        {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const classes = {
    primary: "bg-slate-50 text-emerald-950 hover:bg-emerald-50",
    secondary: "border border-emerald-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-slate-50",
    danger: "bg-rose-700 text-emerald-950 hover:bg-rose-600",
    ghost: "text-slate-700 hover:bg-emerald-50",
  } as const;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50 ${className}`}>
      {children}
    </a>
  );
}
