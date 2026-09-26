import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessOnboardingForm } from "@/components/business/onboarding-form";
import { BrandLogo } from "@/components/brand/logo";
import { requireUser } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const [ownerCount, setting] = await Promise.all([
    db.businessMembership.count({
      where: { userId: user.id, status: "ACTIVE", role: { name: "Owner" } },
    }),
    db.platformSetting.findUnique({ where: { id: "default" } }),
  ]);
  const allowMultiple = setting?.allowMultipleBusinesses ?? true;
  const maximum = setting?.maxBusinessesPerOwner ?? 5;
  if ((!allowMultiple && ownerCount > 0) || ownerCount >= maximum) {
    redirect("/business");
  }

  const currency = (setting?.currency ?? "USD").toUpperCase();
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format((setting?.priceMinor ?? 300) / 100);
  const interval = (setting?.billingInterval ?? "MONTH").toLowerCase();
  const trialDays = setting?.trialDays ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/business" className="rounded-xl border border-emerald-100 bg-white px-4 py-3">
            <BrandLogo className="block w-36" priority />
          </Link>
          <Link href="/business" className="text-sm text-emerald-700 hover:text-emerald-800">Back to workspaces</Link>
        </header>
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Business registration</p>
            <h1 className="mt-3 text-3xl font-bold text-emerald-950">Create your workspace</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-700">Register the business profile now. Rungika creates its roles, permissions, owner membership, subscription, and first invoice together.</p>
            <div className="mt-8"><BusinessOnboardingForm /></div>
          </section>
          <aside className="h-fit space-y-5 rounded-2xl border border-emerald-100 bg-white p-6">
            <div>
              <p className="text-sm text-slate-600">Configured plan</p>
              <p className="mt-1 text-2xl font-bold text-emerald-950">{amount} / business / {interval}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              {trialDays > 0
                ? `A ${trialDays}-day trial is configured. Trial dates are calculated from registration and the first invoice remains open.`
                : "No trial is currently configured. The workspace remains pending until an administrator confirms payment."}
            </div>
            <p className="text-sm leading-6 text-slate-600">Payment instructions appear after registration. Rungika never marks a payment confirmed automatically.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
