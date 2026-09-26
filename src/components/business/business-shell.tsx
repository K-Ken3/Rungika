import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/actions/auth";
import { BrandLogo } from "@/components/brand/logo";
import type { BusinessAccessDTO } from "@/lib/data/business";

const navigation = [
  { href: "", label: "Dashboard" },
  { href: "/tables", label: "Tables & records" },
  { href: "/people", label: "People" },
  { href: "/roles", label: "Roles" },
  { href: "/units", label: "Units" },
  { href: "/billing", label: "Billing", billing: true },
  { href: "/notifications", label: "Notifications" },
  { href: "/support", label: "Support" },
  { href: "/settings", label: "Business settings" },
  { href: "/audit", label: "Audit log" },
  { href: "/exports", label: "Exports" },
] as const;

function navigationLinks(businessId: string, mobile = false) {
  const base = `/business/${encodeURIComponent(businessId)}`;
  return (
    <ul className={mobile ? "space-y-1" : "space-y-1"}>
      {navigation.map((item) => (
        <li key={item.href || "dashboard"}>
          <Link
            href={`${base}${item.href}`}
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-950"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "GRACE_PERIOD") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "PAUSED" || status === "CANCELLED") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-emerald-600 bg-emerald-50 text-emerald-800";
}

function AccessBanner({ access }: { access: BusinessAccessDTO }) {
  if (access.business.adminHold) {
    return (
      <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        This business is on an administrator hold. Billing, payment claims, support, notifications, and profile access remain available.
      </div>
    );
  }
  if (access.business.status === "PENDING_PAYMENT" && access.hasPaidAccess) {
    return (
      <div className="border-b border-emerald-600 bg-emerald-100 px-4 py-3 text-sm text-emerald-800">
        Trial access is active until {new Date(access.subscription?.currentPeriodEnd ?? "").toLocaleDateString()}. The initial invoice remains open.
      </div>
    );
  }
  if (access.business.status === "PENDING_PAYMENT") {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Initial payment is required before operational features can be used. <Link className="font-semibold underline" href={`/business/${encodeURIComponent(access.businessId)}/billing`}>Open billing</Link>.
      </div>
    );
  }
  if (access.business.status === "GRACE_PERIOD") {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Grace-period access is active{access.subscription?.graceEndsAt ? ` until ${new Date(access.subscription.graceEndsAt).toLocaleString()}` : ""}. Submit payment promptly to avoid restriction.
      </div>
    );
  }
  if (access.business.status === "PAUSED") {
    return (
      <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Operational access is paused{access.business.pauseReason ? `: ${access.business.pauseReason}` : "."} Billing and support remain available.
      </div>
    );
  }
  return null;
}

export function BusinessShell({ access, children }: { access: BusinessAccessDTO; children: ReactNode }) {
  const base = `/business/${encodeURIComponent(access.businessId)}`;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href={base} className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
            <BrandLogo className="block w-24" priority />
          </Link>
          <details className="relative">
            <summary className="cursor-pointer rounded-lg border border-emerald-200 px-3 py-2 text-sm">Menu</summary>
            <nav className="absolute right-0 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-emerald-200 bg-white p-3 shadow-2xl">
              {navigationLinks(access.businessId, true)}
              <form action={logout} className="mt-3 border-t border-emerald-100 pt-3">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50" type="submit">Sign out</button>
              </form>
            </nav>
          </details>
        </div>
      </header>
      <AccessBanner access={access} />
      <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-emerald-100 bg-white p-5 lg:flex lg:flex-col">
          <Link href={base} className="mb-7 block rounded-xl border border-emerald-100 bg-slate-50 p-4">
            <BrandLogo className="block w-40" priority />
          </Link>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Workspace</p>
            <p className="mt-2 font-semibold text-emerald-950">{access.business.name}</p>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClass(access.business.status)}`}>
              {access.business.status.replaceAll("_", " ")}
            </span>
          </div>
          <nav className="flex-1">{navigationLinks(access.businessId)}</nav>
          <div className="mt-5 border-t border-emerald-100 pt-4">
            <form action={logout}>
              <button className="w-full rounded-lg border border-emerald-100 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50" type="submit">Sign out</button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
