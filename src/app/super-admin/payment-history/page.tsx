import Link from "next/link";

import { requireAdmin } from "@/lib/auth/authorization";
import { listPaymentHistory, requireActiveAdminMembership } from "@/lib/data/admin";
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

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  await requireActiveAdminMembership(user);
  const params = await searchParams;
  const query = {
    search: first(params.search),
    status: first(params.status),
    method: first(params.method),
    from: first(params.from),
    to: first(params.to),
    page: Number(first(params.page) ?? "1"),
    pageSize: 25,
  };
  const result = await listPaymentHistory(query);
  const filterParams = { search: query.search, status: query.status, method: query.method, from: query.from, to: query.to };

  return (
    <div>
      <AdminPageHeader eyebrow="Financial records" title="Payment and invoice history" description="Confirmed and reversed payment records with invoice, business, administrator, receipt, method, and date details." actions={<Link href="/super-admin/payments" className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">Open payment queue</Link>} />
      <AdminPanel className="mb-6">
        <PanelHeading title="Filter history" description="Search by business, invoice, reference, or receipt number." />
        <SearchForm action="/super-admin/payment-history" className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Search" name="search" defaultValue={query.search ?? ""} placeholder="Business or reference" />
            <SelectField label="Status" name="status" defaultValue={query.status ?? ""} options={[{ value: "", label: "Any status" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "REVERSED", label: "Reversed" }]} />
            <SelectField label="Method" name="method" defaultValue={query.method ?? ""} options={[{ value: "", label: "Any method" }, { value: "MOMO", label: "MoMo claim" }, { value: "MANUAL", label: "Manual" }]} />
            <Field label="From" name="from" type="date" defaultValue={query.from ?? ""} />
            <Field label="To" name="to" type="date" defaultValue={query.to ?? ""} />
          </div>
          <div className="flex justify-end border-t border-emerald-100 pt-4"><button type="submit" className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">Apply filters</button></div>
        </SearchForm>
      </AdminPanel>
      {result.error ? <Notice tone="error">{result.error}</Notice> : null}
      <AdminPanel>
        <PanelHeading title="Payment records" description={`${result.total} record${result.total === 1 ? "" : "s"}`} />
        {result.items.length ? (
          <>
            <AdminTable label="Payment history">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Business / invoice</th><th className="px-5 py-3 font-bold sm:px-6">Reference</th><th className="px-5 py-3 font-bold sm:px-6">Amount</th><th className="px-5 py-3 font-bold sm:px-6">Method</th><th className="px-5 py-3 font-bold sm:px-6">Status</th><th className="px-5 py-3 font-bold sm:px-6">Confirmed by</th><th className="px-5 py-3 font-bold sm:px-6">Date</th></tr></TableHead>
              <tbody>
                {result.items.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell><Link href={`/super-admin/businesses/${payment.businessId}`} className="font-extrabold text-slate-900">{payment.businessName}</Link><p className="mt-1 text-xs text-slate-600">{payment.invoiceNumber} · receipt {payment.receiptNumber}</p></TableCell>
                    <TableCell><span className="font-mono text-xs font-bold text-slate-800">{payment.reference}</span></TableCell>
                    <TableCell className="font-bold"><Money amountMinor={payment.amountMinor} currency={payment.currency} /></TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell><StatusBadge value={payment.status} /></TableCell>
                    <TableCell><span className="font-bold text-slate-800">{payment.adminName}</span><p className="mt-1 text-xs text-slate-600">{payment.adminEmail}</p></TableCell>
                    <TableCell><DateText value={payment.confirmedAt} withTime /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/super-admin/payment-history" params={filterParams} />
          </>
        ) : <EmptyState title="No payment records found" description="No confirmed or reversed payments match these filters." />}
      </AdminPanel>
    </div>
  );
}
