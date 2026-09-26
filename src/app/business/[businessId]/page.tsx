import Link from "next/link";

import { requireUser } from "@/lib/auth/authorization";
import { getBusinessDashboard } from "@/lib/data/business";

function readableAction(value: string) {
  return value.toLowerCase().replaceAll(".", " · ").replaceAll("_", " ");
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { businessId } = await params;
  const { created } = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}`);
  const dashboard = await getBusinessDashboard(user.id, businessId);
  const base = `/business/${encodeURIComponent(businessId)}`;
  const metrics = [
    { label: "Active people", value: dashboard.metrics.activeMembers, href: `${base}/people` },
    { label: "Units", value: dashboard.metrics.units, href: `${base}/units` },
    { label: "Custom tables", value: dashboard.metrics.customTables, href: `${base}/tables` },
    { label: "Active records", value: dashboard.metrics.records, href: `${base}/tables` },
    { label: "Open invoices", value: dashboard.metrics.openInvoices, href: `${base}/billing` },
    { label: "Unread notifications", value: dashboard.metrics.unreadNotifications, href: `${base}/notifications` },
  ];
  return (
    <div className="space-y-8">
      {created ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Business workspace created. Review the initial invoice before using operational features.</div>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Dashboard</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">{dashboard.business.name}</h1><p className="mt-2 text-slate-600">Live workspace data for {dashboard.business.country}.</p></div>
        <div className="flex flex-wrap gap-3"><Link href={`${base}/tables`} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-emerald-950">Open tables</Link><Link href={`${base}/people`} className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm text-slate-800">Manage people</Link></div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="rounded-2xl border border-emerald-100 bg-white p-5 transition hover:border-emerald-600">
            <p className="text-sm text-slate-600">{metric.label}</p><p className="mt-3 text-3xl font-bold text-emerald-950">{metric.value}</p>
          </Link>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="rounded-2xl border border-emerald-100 bg-white p-6">
          <h2 className="text-lg font-bold text-emerald-950">Recent activity</h2>
          {dashboard.recentActivity.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-emerald-100 p-5 text-sm text-slate-600">No activity has been recorded yet.</p> : (
            <ol className="mt-5 space-y-4">{dashboard.recentActivity.map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 pb-4 last:border-0"><div><p className="text-sm font-medium text-slate-800">{readableAction(entry.action)}</p><p className="mt-1 text-xs text-slate-600">{entry.actorName ?? "System"}</p></div><time className="text-xs text-slate-600">{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ol>
          )}
        </div>
        <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-6">
          <h2 className="text-lg font-bold text-emerald-950">Subscription</h2>
          {dashboard.subscription ? <dl className="space-y-4 text-sm"><div><dt className="text-slate-600">Plan</dt><dd className="mt-1 text-slate-900">{dashboard.subscription.planNameSnapshot}</dd></div><div><dt className="text-slate-600">Amount</dt><dd className="mt-1 text-slate-900">{new Intl.NumberFormat("en", { style: "currency", currency: dashboard.subscription.currency }).format(dashboard.subscription.amountMinor / 100)} / {dashboard.subscription.interval.toLowerCase()}</dd></div><div><dt className="text-slate-600">Next due</dt><dd className="mt-1 text-slate-900">{new Date(dashboard.subscription.dueDate).toLocaleString()}</dd></div></dl> : <p className="text-sm text-slate-600">No subscription is attached.</p>}
          <Link href={`${base}/billing`} className="inline-block text-sm font-semibold text-emerald-700">View billing history →</Link>
        </div>
      </section>
    </div>
  );
}
