import Link from "next/link";

import { requireAdmin } from "@/lib/auth/authorization";
import { listAuditLogs, requireActiveAdminMembership } from "@/lib/data/admin";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  DateText,
  EmptyState,
  Field,
  Notice,
  Pagination,
  PanelHeading,
  SearchForm,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/admin/ui";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  await requireActiveAdminMembership(user);
  const params = await searchParams;
  const query = {
    search: first(params.search),
    action: first(params.action),
    entityType: first(params.entityType),
    businessId: first(params.businessId),
    from: first(params.from),
    to: first(params.to),
    page: Number(first(params.page) ?? "1"),
    pageSize: 30,
  };
  const result = await listAuditLogs(query);
  const filterParams = { search: query.search, action: query.action, entityType: query.entityType, businessId: query.businessId, from: query.from, to: query.to };

  return (
    <div>
      <AdminPageHeader eyebrow="Accountability" title="Audit log" description="Search administrator actions across businesses, invoices, subscriptions, payments, support, and platform settings. Metadata is displayed exactly as stored." />
      <AdminPanel className="mb-6">
        <PanelHeading title="Filter audit events" description="Use a business ID from a business profile to scope the log." />
        <SearchForm action="/super-admin/audit" className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Search" name="search" defaultValue={query.search ?? ""} placeholder="Action, entity, actor, or business" />
            <Field label="Action" name="action" defaultValue={query.action ?? ""} placeholder="e.g. PAYMENT" />
            <Field label="Entity type" name="entityType" defaultValue={query.entityType ?? ""} placeholder="e.g. Invoice" />
            <Field label="Business ID" name="businessId" defaultValue={query.businessId ?? ""} placeholder="Optional business ID" />
            <Field label="From" name="from" type="date" defaultValue={query.from ?? ""} />
            <Field label="To" name="to" type="date" defaultValue={query.to ?? ""} />
          </div>
          <div className="flex justify-end border-t border-emerald-100 pt-4"><button type="submit" className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">Apply filters</button></div>
        </SearchForm>
      </AdminPanel>
      {result.error ? <Notice tone="error">{result.error}</Notice> : null}
      <AdminPanel>
        <PanelHeading title="Audit events" description={`${result.total} event${result.total === 1 ? "" : "s"}`} />
        {result.items.length ? (
          <>
            <AdminTable label="Administrator audit log">
              <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Action</th><th className="px-5 py-3 font-bold sm:px-6">Actor</th><th className="px-5 py-3 font-bold sm:px-6">Business</th><th className="px-5 py-3 font-bold sm:px-6">Metadata</th><th className="px-5 py-3 font-bold sm:px-6">When</th></tr></TableHead>
              <tbody>
                {result.items.map((auditLog) => (
                  <TableRow key={auditLog.id}>
                    <TableCell><span className="font-extrabold text-slate-800">{auditLog.action}</span><p className="mt-1 text-xs text-slate-600">{auditLog.entityType}{auditLog.entityId ? ` · ${auditLog.entityId}` : ""}</p></TableCell>
                    <TableCell><span className="font-bold text-slate-800">{auditLog.actorName ?? "System"}</span>{auditLog.actorEmail ? <p className="mt-1 text-xs text-slate-600">{auditLog.actorEmail}</p> : null}</TableCell>
                    <TableCell>{auditLog.businessName && auditLog.businessId ? <Link href={`/super-admin/businesses/${auditLog.businessId}`} className="text-xs font-bold text-emerald-700">{auditLog.businessName}</Link> : "—"}</TableCell>
                    <TableCell><code className="block max-w-md break-words text-xs text-slate-600">{auditLog.metadata ? JSON.stringify(auditLog.metadata) : "—"}</code></TableCell>
                    <TableCell><DateText value={auditLog.createdAt} withTime /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/super-admin/audit" params={filterParams} />
          </>
        ) : <EmptyState title="No audit events found" description="No audited events match these filters." />}
      </AdminPanel>
    </div>
  );
}
