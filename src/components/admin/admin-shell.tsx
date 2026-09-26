"use client";

import {
  Building2,
  CreditCard,
  FileClock,
  LayoutDashboard,
  Menu,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/super-admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/super-admin/payments", label: "Payment queue", icon: CreditCard },
  { href: "/super-admin/payment-history", label: "Payment history", icon: ReceiptText },
  { href: "/super-admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/super-admin/platform-settings", label: "Platform settings", icon: Settings2 },
  { href: "/super-admin/admin-users", label: "Admin users", icon: UsersRound },
] as const;

function NavigationLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: typeof LayoutDashboard; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = href === "/super-admin" ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-emerald-400 text-emerald-950 shadow-sm"
          : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-950"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Super admin navigation">
      {navigation.map((item) => (
        <NavigationLink key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/super-admin" className="flex items-center gap-3 text-emerald-950">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-emerald-950">
        <ShieldCheck size={22} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-black tracking-wide">RUNGIKA</span>
        <span className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-800">Control center</span>
      </span>
    </Link>
  );
}

export function AdminShell({
  children,
  name,
  email,
  role,
}: {
  children: ReactNode;
  name: string;
  email: string;
  role: string;
}) {
  return (
    <div className="min-h-screen bg-[#f5f8f6] text-slate-900">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-50 focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-emerald-950">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-emerald-100 bg-white px-5 py-6 lg:flex">
        <Brand />
        <div className="mt-10 flex-1">
          <p className="mb-3 px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
          <Navigation />
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="truncate text-sm font-extrabold text-emerald-950">{name}</p>
          <p className="mt-1 truncate text-xs text-slate-600">{email}</p>
          <p className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
            {role.replaceAll("_", " ")}
          </p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-[#f5f8f6]/90 backdrop-blur-xl">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <details className="group relative">
                <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-emerald-100 bg-white text-slate-800 marker:hidden">
                  <Menu size={20} aria-hidden="true" />
                  <span className="sr-only">Open navigation</span>
                </summary>
                <div className="absolute left-0 top-14 w-72 rounded-2xl border border-emerald-100 bg-slate-50 p-4 shadow-2xl">
                  <div className="mb-5 flex items-center justify-between">
                    <Brand />
                    <X size={18} className="text-slate-600" aria-hidden="true" />
                  </div>
                  <Navigation />
                </div>
              </details>
              <Link href="/super-admin" className="text-sm font-black tracking-wide text-emerald-950">
                RUNGIKA <span className="font-bold text-emerald-700">ADMIN</span>
              </Link>
            </div>
            <div className="hidden items-center gap-2 text-sm text-slate-600 lg:flex">
              <FileClock size={17} aria-hidden="true" />
              <span>Operations workspace</span>
              <span className="mx-1 text-slate-700">/</span>
              <span className="font-bold text-slate-700">Live data</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-right sm:block">
                <span className="block text-xs font-extrabold text-slate-800">{name}</span>
                <span className="block text-[0.7rem] text-slate-600">{role.replaceAll("_", " ")}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
                {name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
        </header>
        <main id="admin-content" className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
