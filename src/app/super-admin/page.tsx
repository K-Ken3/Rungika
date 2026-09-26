import Link from "next/link";

import { requireAdmin } from "@/lib/auth/authorization";
import { getAdminDashboardData, requireActiveAdminMembership } from "@/lib/data/admin";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  DateText,
  EmptyState,
  MetricCard,
  Money,
  PanelHeading,
  StatusBadge,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/admin/ui";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  await requireActiveAdminMembership(user);
  const params = await searchParams;
  const periodValue = Number(first(params.period) ?? "30");
  const periodDays = Number.isInteger(periodValue) && periodValue >= 1 && periodValue <= 365 ? periodValue : 30;
  const data = await getAdminDashboardData(periodDays);
  const statusLabels = [
    ["ACTIVE", "Active"],
    ["PENDING_PAYMENT", "Pending payment"],
    ["GRACE_PERIOD", "Grace period"],
    ["PAUSED", "Paused"],
    ["CANCELLED", "Cancelled"],
  ] as const;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Super admin overview"
        title="Operations at a glance"
        description="A live view of businesses, subscription activity, payment decisions, and delivery exceptions. Every figure comes from the application database."
        actions={
          <Link href="/super-admin/payments" className="inline-flex items-center rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">
            Review payment queue
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total businesses" value={data.totalBusinesses} detail="All registered workspaces" href="/super-admin/businesses" />
        <MetricCard label="Claims awaiting review" value={data.claimsAwaitingReview} detail="Submitted or under review" tone={data.claimsAwaitingReview ? "warning" : "success"} href="/super-admin/payments" />
        <MetricCard label="Confirmed payments" value={data.confirmedPaymentCount} detail={`Last ${data.periodDays} days`} tone="success" />
        <MetricCard label="Delivery exceptions" value={data.notificationDeliveryCounts.FAILED + data.notificationDeliveryCounts.SKIPPED} detail="Failed or skipped notifications" tone={data.notificationDeliveryCounts.FAILED ? "danger" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel>
          <PanelHeading title="Business status" description="Current stored status counts" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            {statusLabels.map(([status, label]) => (
              <Link key={status} href={`/super-admin/businesses?status=${status}`} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-slate-50 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <span className="text-xl font-black text-emerald-950">{data.businessStatusCounts[status]}</span>
              </Link>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <PanelHeading title="Confirmed payments" description={`Filterable period: last ${data.periodDays} days`} />
          <div className="space-y-4 p-5 sm:p-6">
            {data.confirmedPaymentTotals.length ? (
              data.confirmedPaymentTotals.map((total) => (
                <div key={total.currency} className="flex items-end justify-between gap-4 border-b border-emerald-100 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">{total.currency}</p>
                    <p className="mt-1 text-xs text-slate-600">{total.count} confirmed payment{total.count === 1 ? "" : "s"}</p>
                  </div>
                  <p className="text-lg font-black text-emerald-950"><Money amountMinor={total.amountMinor} currency={total.currency} /></p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No confirmed payments in this period.</p>
            )}
            <form method="get" className="flex flex-wrap items-end gap-3 border-t border-emerald-100 pt-4">
              <div className="min-w-40 flex-1">
                <label htmlFor="dashboard-period" className="mb-1 block text-xs font-extrabold uppercase tracking-[0.08em] text-slate-600">Period</label>
                <select id="dashboard-period" name="period" defaultValue={String(data.periodDays)} className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last year</option>
                </select>
              </div>
              <button type="submit" className="rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-sm font-extrabold text-slate-800 transition hover:border-emerald-300">Apply</button>
            </form>
          </div>
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminPanel>
          <PanelHeading title="Upcoming renewals" description="Due in the next 30 days" action={<Link href="/super-admin/payment-history" className="text-sm font-extrabold text-emerald-700">View payments</Link>} />
          {data.upcomingRenewals.length ? (
            <AdminTable label="Upcoming renewals">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Business</th><th className="px-5 py-3 font-bold sm:px-6">Due</th><th className="px-5 py-3 font-bold sm:px-6">Plan</th><th className="px-5 py-3 text-right font-bold sm:px-6">Amount</th></tr></TableHead>
              <tbody>
                {data.upcomingRenewals.map((renewal) => (
                  <TableRow key={renewal.id}>
                    <TableCell><Link href={`/super-admin/businesses/${renewal.businessId}`} className="font-extrabold text-slate-900">{renewal.businessName}</Link></TableCell>
                    <TableCell><DateText value={renewal.dueDate} /></TableCell>
                    <TableCell><span className="text-sm font-bold text-slate-700">{renewal.planName}</span><div className="mt-1"><StatusBadge value={renewal.status} /></div></TableCell>
                    <TableCell className="text-right font-bold"><Money amountMinor={renewal.amountMinor} currency={renewal.currency} /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
          ) : <EmptyState title="No upcoming renewals" description="There are no non-cancelled subscriptions due in the next 30 days." />}
        </AdminPanel>

        <AdminPanel>
          <PanelHeading title="Recent admin actions" description="Audited platform and business operations" action={<Link href="/super-admin/audit" className="text-sm font-extrabold text-emerald-700">Open audit log</Link>} />
          {data.recentActions.length ? (
            <AdminTable label="Recent admin actions">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Action</th><th className="px-5 py-3 font-bold sm:px-6">Actor</th><th className="px-5 py-3 font-bold sm:px-6">When</th></tr></TableHead>
              <tbody>
                {data.recentActions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell><p className="font-extrabold text-slate-800">{action.action}</p><p className="mt-1 text-xs text-slate-600">{action.entityType}{action.businessName ? ` · ${action.businessName}` : ""}</p></TableCell>
                    <TableCell><span className="text-sm font-semibold text-slate-700">{action.actorName ?? "System"}</span></TableCell>
                    <TableCell><DateText value={action.createdAt} withTime /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
          ) : <EmptyState title="No admin actions yet" description="Audited administrator actions will appear here." />}
        </AdminPanel>
      </div>

      <AdminPanel className="mt-6">
        <PanelHeading title="Notification delivery exceptions" description="Failed and skipped channel deliveries, not inferred message outcomes" />
        {data.recentFailedDeliveries.length ? (
          <AdminTable label="Notification delivery exceptions">
            <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Notification</th><th className="px-5 py-3 font-bold sm:px-6">Channel</th><th className="px-5 py-3 font-bold sm:px-6">Status</th><th className="px-5 py-3 font-bold sm:px-6">Attempts</th><th className="px-5 py-3 font-bold sm:px-6">Scheduled</th></tr></TableHead>
            <tbody>
              {data.recentFailedDeliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell><span className="font-bold text-slate-800">{delivery.notificationTitle}</span>{delivery.error ? <p className="mt-1 max-w-sm text-xs text-rose-700">{delivery.error}</p> : null}</TableCell>
                  <TableCell>{delivery.channel}</TableCell>
                  <TableCell><StatusBadge value={delivery.status} /></TableCell>
                  <TableCell>{delivery.attempts}</TableCell>
                  <TableCell><DateText value={delivery.scheduledAt} withTime /></TableCell>
                </TableRow>
              ))}
            </tbody>
          </AdminTable>
        ) : <EmptyState title="No delivery exceptions" description="Failed and skipped notification deliveries will be listed here." />}
      </AdminPanel>
    </div>
  );
}
