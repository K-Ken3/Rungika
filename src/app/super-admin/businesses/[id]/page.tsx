import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { getBusinessDetail, requireActiveAdminMembership } from "@/lib/data/admin";
import { BusinessControls, SupportCaseControl } from "@/components/admin/business-controls";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  DateText,
  KeyValue,
  Money,
  Notice,
  PanelHeading,
  StatusBadge,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/admin/ui";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const { id } = await params;
  const business = await getBusinessDetail(id);
  if (!business) {
    notFound();
  }
  const canManage = admin.role === "SUPER_ADMIN";
  const canManageSupport = admin.role === "SUPER_ADMIN" || admin.role === "SUPPORT";

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/businesses" className="text-sm font-extrabold text-emerald-700">← Back to businesses</Link>
      </div>
      <AdminPageHeader
        eyebrow="Business profile"
        title={business.name}
        description={`${business.slug} · ${business.country} · Joined ${new Date(business.createdAt).toLocaleDateString("en")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={business.status} />
            {business.adminHold ? <StatusBadge value="PAUSED" /> : null}
          </div>
        }
      />

      {business.adminHold ? <Notice tone="warning">This business has an active administrator hold. Review the audit history before changing payment or operational decisions.</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel>
          <PanelHeading title="Business profile" description="Operational and contact information visible to administrators" />
          <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <KeyValue label="Category">{business.category ?? "—"}</KeyValue>
            <KeyValue label="Timezone">{business.timezone}</KeyValue>
            <KeyValue label="Location">{business.location ?? "—"}</KeyValue>
            <KeyValue label="Phone">{business.phone ?? "—"}</KeyValue>
            <KeyValue label="Business email">{business.email ?? "—"}</KeyValue>
            <KeyValue label="Created by">{business.createdBy.name}<span className="mt-1 block text-xs font-normal text-slate-600">{business.createdBy.email}</span></KeyValue>
            <KeyValue label="Description">{business.description ?? "—"}</KeyValue>
            <KeyValue label="Last updated"><DateText value={business.updatedAt} withTime /></KeyValue>
          </dl>
        </AdminPanel>

        <AdminPanel>
          <PanelHeading title="Subscription" description="Stored billing state and next due date" />
          {business.subscription ? (
            <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <KeyValue label="Plan">{business.subscription.planNameSnapshot}</KeyValue>
              <KeyValue label="Status"><StatusBadge value={business.subscription.status} /></KeyValue>
              <KeyValue label="Amount"><Money amountMinor={business.subscription.amountMinor} currency={business.subscription.currency} /> <span className="text-xs font-normal text-slate-600">/ {business.subscription.interval.toLowerCase()}</span></KeyValue>
              <KeyValue label="Auto-renew">{business.subscription.autoRenew ? "Enabled" : "Disabled"}</KeyValue>
              <KeyValue label="Current period"><DateText value={business.subscription.currentPeriodStart} /> – <DateText value={business.subscription.currentPeriodEnd} /></KeyValue>
              <KeyValue label="Due date"><DateText value={business.subscription.dueDate} /></KeyValue>
              {business.subscription.graceEndsAt ? <KeyValue label="Grace ends"><DateText value={business.subscription.graceEndsAt} withTime /></KeyValue> : null}
              {business.subscription.pausedAt ? <KeyValue label="Paused at"><DateText value={business.subscription.pausedAt} withTime /></KeyValue> : null}
            </dl>
          ) : <div className="p-6"><p className="text-sm text-slate-600">No subscription is attached to this business.</p></div>}
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminPanel>
          <PanelHeading title="Members" description={`${business.memberCount} active membership${business.memberCount === 1 ? "" : "s"}`} />
          {business.members.length ? (
            <AdminTable label="Business members">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Member</th><th className="px-5 py-3 font-bold sm:px-6">Role</th><th className="px-5 py-3 font-bold sm:px-6">Unit</th></tr></TableHead>
              <tbody>
                {business.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell><span className="font-extrabold text-slate-800">{member.name}</span><p className="mt-1 text-xs text-slate-600">{member.email}</p></TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>{member.unitName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
          ) : <div className="p-6 text-sm text-slate-600">No active members are visible.</div>}
        </AdminPanel>

        <AdminPanel>
          <PanelHeading title="Invoices" description="Most recent invoices for this business" />
          {business.invoices.length ? (
            <AdminTable label="Business invoices">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Invoice</th><th className="px-5 py-3 font-bold sm:px-6">Due</th><th className="px-5 py-3 font-bold sm:px-6">Status</th><th className="px-5 py-3 text-right font-bold sm:px-6">Amount</th></tr></TableHead>
              <tbody>
                {business.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell><span className="font-extrabold text-slate-800">{invoice.number}</span>{invoice.paidAt ? <p className="mt-1 text-xs text-slate-600">Paid <DateText value={invoice.paidAt} /></p> : null}</TableCell>
                    <TableCell><DateText value={invoice.dueDate} /></TableCell>
                    <TableCell><StatusBadge value={invoice.status} /></TableCell>
                    <TableCell className="text-right font-bold"><Money amountMinor={invoice.amountMinor} currency={invoice.currency} /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
          ) : <div className="p-6 text-sm text-slate-600">No invoices have been created.</div>}
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <AdminPanel>
          <PanelHeading title="Payment claims" description="Submitted and historical claims" />
          {business.claims.length ? (
            <AdminTable label="Business payment claims">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Reference</th><th className="px-5 py-3 font-bold sm:px-6">Invoice</th><th className="px-5 py-3 font-bold sm:px-6">Status</th><th className="px-5 py-3 font-bold sm:px-6">Proof</th></tr></TableHead>
              <tbody>
                {business.claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell><span className="font-mono text-xs font-bold text-slate-800">{claim.reference}</span><p className="mt-1 text-xs text-slate-600">Sent <DateText value={claim.sentAt} /> by {claim.submittedByName}</p></TableCell>
                    <TableCell>{claim.invoiceNumber}</TableCell>
                    <TableCell><StatusBadge value={claim.status} /></TableCell>
                    <TableCell>{claim.proofName ? <a href={`/api/files/claims/${claim.id}`} target="_blank" rel="noreferrer" className="text-xs font-extrabold text-emerald-700">{claim.proofName}</a> : <span className="text-xs text-slate-600">No proof metadata</span>}{claim.proofMime ? <p className="mt-1 text-[0.7rem] text-slate-600">{claim.proofMime}</p> : null}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
          ) : <div className="p-6 text-sm text-slate-600">No payment claims have been submitted.</div>}
        </AdminPanel>

        <AdminPanel>
          <PanelHeading title="Support cases" description="Issues reported by business members" />
          {business.supportCases.length ? (
            <div className="divide-y divide-slate-100">
              {business.supportCases.map((supportCase) => (
                <article key={supportCase.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-extrabold text-slate-900">{supportCase.subject}</h3><p className="mt-1 text-xs text-slate-600">{supportCase.reporterName} · <DateText value={supportCase.createdAt} withTime /></p></div>
                    <StatusBadge value={supportCase.status} />
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{supportCase.message}</p>
                  <div className="mt-4"><SupportCaseControl caseId={supportCase.id} currentStatus={supportCase.status} canManage={canManageSupport} /></div>
                </article>
              ))}
            </div>
          ) : <div className="p-6 text-sm text-slate-600">No support cases have been reported.</div>}
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel>
          <PanelHeading title="Administrator controls" description="Every change requires a reason and creates an audit record" />
          <div className="p-5 sm:p-6"><BusinessControls businessId={business.id} status={business.status} adminHold={business.adminHold} canManage={canManage} canManageSupport={canManageSupport} /></div>
        </AdminPanel>
        <AdminPanel>
          <PanelHeading title="Internal notes" description="Administrator-only context" />
          {business.adminNotes.length ? (
            <div className="divide-y divide-slate-100">
              {business.adminNotes.map((note) => <article key={note.id} className="p-5 sm:p-6"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p><p className="mt-3 text-xs text-slate-600">{note.authorName} · <DateText value={note.createdAt} withTime /></p></article>)}
            </div>
          ) : <div className="p-6 text-sm text-slate-600">No internal notes have been added.</div>}
        </AdminPanel>
      </div>

      <AdminPanel className="mt-6">
        <PanelHeading title="Business audit history" description="Most recent audited events for this business" action={<Link href={`/super-admin/audit?businessId=${business.id}`} className="text-sm font-extrabold text-emerald-700">Open full audit log</Link>} />
        {business.auditLogs.length ? (
          <AdminTable label="Business audit history">
            <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Action</th><th className="px-5 py-3 font-bold sm:px-6">Actor</th><th className="px-5 py-3 font-bold sm:px-6">Metadata</th><th className="px-5 py-3 font-bold sm:px-6">When</th></tr></TableHead>
            <tbody>
              {business.auditLogs.map((auditLog) => <TableRow key={auditLog.id}><TableCell><span className="font-extrabold text-slate-800">{auditLog.action}</span><p className="mt-1 text-xs text-slate-600">{auditLog.entityType}{auditLog.entityId ? ` · ${auditLog.entityId}` : ""}</p></TableCell><TableCell>{auditLog.actorName ?? "System"}</TableCell><TableCell><code className="block max-w-sm break-words text-xs text-slate-600">{auditLog.metadata ? JSON.stringify(auditLog.metadata) : "—"}</code></TableCell><TableCell><DateText value={auditLog.createdAt} withTime /></TableCell></TableRow>)}
            </tbody>
          </AdminTable>
        ) : <div className="p-6 text-sm text-slate-600">No audit events have been recorded.</div>}
      </AdminPanel>
    </div>
  );
}
