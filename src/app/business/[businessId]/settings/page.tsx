import { BusinessProfileForm } from "@/components/business/profile-form";
import { requireUser, hasBusinessPermission } from "@/lib/auth/authorization";
import { getBusinessSettings } from "@/lib/data/business";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { businessId } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/settings`);
  const [data, canEdit] = await Promise.all([
    getBusinessSettings(user.id, businessId),
    hasBusinessPermission(user.id, businessId, "business.edit"),
  ]);
  const amount = new Intl.NumberFormat("en", { style: "currency", currency: data.settings.currency }).format(data.settings.priceMinor / 100);
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Configuration</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Business settings</h1><p className="mt-2 text-slate-600">Profile information and the current platform plan policy.</p></header>
      {saved ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Settings saved.</div> : null}
      <section className="rounded-2xl border border-emerald-100 bg-white p-6">
        <h2 className="text-xl font-bold text-emerald-950">Business profile</h2>
        <div className="mt-6">{canEdit ? <BusinessProfileForm businessId={businessId} business={data.business} /> : <p className="rounded-xl border border-emerald-100 p-5 text-sm text-slate-600">Your role can view this profile but cannot edit it.</p>}</div>
      </section>
      <section className="rounded-2xl border border-emerald-100 bg-white p-6"><h2 className="text-xl font-bold text-emerald-950">Current plan policy</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-sm"><div><dt className="text-slate-600">Plan</dt><dd className="mt-1 text-emerald-950">{data.settings.planName}</dd></div><div><dt className="text-slate-600">Default amount</dt><dd className="mt-1 text-emerald-950">{amount} / {data.settings.billingInterval.toLowerCase()}</dd></div><div><dt className="text-slate-600">Trial</dt><dd className="mt-1 text-emerald-950">{data.settings.trialDays} days</dd></div><div><dt className="text-slate-600">Grace period</dt><dd className="mt-1 text-emerald-950">{data.settings.gracePeriodDays} days</dd></div></dl><p className="mt-5 text-sm text-slate-600">Only Super Admin can change platform-wide plan, trial, payment, and reminder policy.</p></section>
    </div>
  );
}
