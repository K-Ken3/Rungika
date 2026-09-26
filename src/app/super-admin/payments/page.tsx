import Link from "next/link";

import { requireAdmin } from "@/lib/auth/authorization";
import { listOpenInvoiceOptions, listPaymentClaims, requireActiveAdminMembership } from "@/lib/data/admin";
import { PaymentClaimActions, ManualPaymentForm } from "@/components/admin/payment-controls";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  DateText,
  EmptyState,
  Field,
  Money,
  Notice,
  Pagination,
  PanelHeading,
  SearchForm,
  SelectField,
  StatusBadge,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/admin/ui";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const params = await searchParams;
  const query = {
    search: first(params.search),
    status: first(params.status),
    page: Number(first(params.page) ?? "1"),
    pageSize: 20,
  };
  const [queue, openInvoices] = await Promise.all([
    listPaymentClaims(query),
    listOpenInvoiceOptions(),
  ]);
  const canManagePayments = admin.role === "SUPER_ADMIN" || admin.role === "FINANCE";
  const filterParams = { search: query.search, status: query.status };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Billing operations"
        title="Payment queue"
        description="Review only submitted and under-review claims. Confirmations use the transactional billing service and current administrator membership; rejections require a reason."
        actions={<Link href="/super-admin/payment-history" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 transition hover:border-emerald-300">Payment history</Link>}
      />

      {!canManagePayments ? <Notice tone="info">Your role can inspect the queue, but payment decisions and manual recording require finance or super administrator permissions.</Notice> : null}

      <AdminPanel className="mb-6">
        <PanelHeading title="Filter the review queue" description="The queue never includes confirmed, rejected, or cancelled claims." />
        <SearchForm action="/super-admin/payments" className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Reference, business, invoice, or submitter" name="search" defaultValue={query.search ?? ""} placeholder="Search queue" />
            <SelectField label="Claim status" name="status" defaultValue={query.status ?? ""} options={[{ value: "", label: "All queue statuses" }, { value: "SUBMITTED", label: "Submitted" }, { value: "UNDER_REVIEW", label: "Under review" }]} />
            <div className="flex items-end"><button type="submit" className="w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">Apply filters</button></div>
          </div>
        </SearchForm>
      </AdminPanel>

      {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}

      <AdminPanel className="mb-6">
        <PanelHeading title="Claims awaiting a decision" description={`${queue.total} claim${queue.total === 1 ? "" : "s"} in the queue`} />
        {queue.items.length ? (
          <>
            <AdminTable label="Payment claim queue">
              <TableHead>
                <tr>
                  <th className="px-5 py-3 font-bold sm:px-6">Business / invoice</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Reference</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Amount</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Status</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Proof metadata</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Decision</th>
                </tr>
              </TableHead>
              <tbody>
                {queue.items.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell><Link href={`/super-admin/businesses/${claim.businessId}`} className="font-extrabold text-slate-900">{claim.businessName}</Link><p className="mt-1 text-xs text-slate-600">{claim.invoiceNumber} · submitted by {claim.submittedByName}</p><p className="mt-1 text-xs text-slate-600"><DateText value={claim.sentAt} withTime /></p></TableCell>
                    <TableCell><span className="font-mono text-xs font-bold text-slate-800">{claim.reference}</span>{claim.duplicateReference ? <p className="mt-2 max-w-48 text-xs font-extrabold text-rose-700">Duplicate reference{claim.duplicateBusinessName ? ` · ${claim.duplicateBusinessName}` : ""}</p> : null}</TableCell>
                    <TableCell className="font-bold"><Money amountMinor={claim.amountMinor} currency={claim.currency} /></TableCell>
                    <TableCell><StatusBadge value={claim.status} />{claim.underReviewByName ? <p className="mt-2 text-xs text-slate-600">Reviewer: {claim.underReviewByName}</p> : null}</TableCell>
                    <TableCell>{claim.proofName ? <><a href={`/api/files/claims/${claim.id}`} target="_blank" rel="noreferrer" className="text-xs font-extrabold text-emerald-700">Download proof</a><p className="mt-1 max-w-36 truncate text-xs text-slate-600">{claim.proofName}</p>{claim.proofMime ? <p className="mt-1 text-[0.7rem] text-slate-600">{claim.proofMime}</p> : null}</> : <span className="text-xs text-slate-600">No proof metadata</span>}</TableCell>
                    <TableCell><PaymentClaimActions claim={claim} canManagePayments={canManagePayments} /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
            <Pagination page={queue.page} totalPages={queue.totalPages} basePath="/super-admin/payments" params={filterParams} />
          </>
        ) : <EmptyState title="Queue is clear" description="There are no submitted or under-review payment claims matching these filters." />}
      </AdminPanel>

      <AdminPanel>
        <PanelHeading title="Record a manual payment" description="Select an open or overdue invoice. Amount and currency are taken from the invoice on the server." />
        <div className="p-5 sm:p-6"><ManualPaymentForm options={openInvoices} canManagePayments={canManagePayments} /></div>
      </AdminPanel>
    </div>
  );
}
