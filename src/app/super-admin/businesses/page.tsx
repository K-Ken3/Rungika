import Link from "next/link";

import { requireAdmin } from "@/lib/auth/authorization";
import { listBusinesses, requireActiveAdminMembership } from "@/lib/data/admin";
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

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  await requireActiveAdminMembership(user);
  const params = await searchParams;
  const query = {
    search: first(params.search),
    owner: first(params.owner),
    status: first(params.status),
    plan: first(params.plan),
    createdFrom: first(params.createdFrom),
    createdTo: first(params.createdTo),
    dueFrom: first(params.dueFrom),
    dueTo: first(params.dueTo),
    page: Number(first(params.page) ?? "1"),
    pageSize: 20,
  };
  const result = await listBusinesses(query);
  const filterParams = {
    search: query.search,
    owner: query.owner,
    status: query.status,
    plan: query.plan,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
    dueFrom: query.dueFrom,
    dueTo: query.dueTo,
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Business directory"
        title="Businesses"
        description="Search and filter registered workspaces by identity, owner, registration date, status, plan, and subscription due date. Results are queried on the server."
        actions={<Link href="/super-admin/payment-history" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 transition hover:border-emerald-300">Payment history</Link>}
      />

      <AdminPanel className="mb-6">
        <PanelHeading title="Find a business" description="Filters are validated before they reach the database query." />
        <SearchForm action="/super-admin/businesses" className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Name, slug, or email" name="search" defaultValue={query.search ?? ""} placeholder="Search businesses" />
            <Field label="Owner name or email" name="owner" defaultValue={query.owner ?? ""} placeholder="Search owner" />
            <SelectField
              label="Business status"
              name="status"
              defaultValue={query.status ?? ""}
              options={[
                { value: "", label: "Any status" },
                { value: "PENDING_PAYMENT", label: "Pending payment" },
                { value: "ACTIVE", label: "Active" },
                { value: "GRACE_PERIOD", label: "Grace period" },
                { value: "PAUSED", label: "Paused" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
            <SelectField
              label="Plan"
              name="plan"
              defaultValue={query.plan ?? ""}
              options={[{ value: "", label: "Any plan" }, ...result.plans.map((plan) => ({ value: plan, label: plan }))]}
            />
            <Field label="Created from" name="createdFrom" type="date" defaultValue={query.createdFrom ?? ""} />
            <Field label="Created to" name="createdTo" type="date" defaultValue={query.createdTo ?? ""} />
            <Field label="Due from" name="dueFrom" type="date" defaultValue={query.dueFrom ?? ""} />
            <Field label="Due to" name="dueTo" type="date" defaultValue={query.dueTo ?? ""} />
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-emerald-100 pt-4">
            <Link href="/super-admin/businesses" className="rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-emerald-50">Clear filters</Link>
            <button type="submit" className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50">Search businesses</button>
          </div>
        </SearchForm>
      </AdminPanel>

      {result.error ? <Notice tone="error">{result.error}</Notice> : null}

      <AdminPanel>
        <PanelHeading title="Business results" description={`${result.total} matching business${result.total === 1 ? "" : "es"}`} />
        {result.items.length ? (
          <>
            <AdminTable label="Business search results">
              <TableHead>
                <tr>
                  <th className="px-5 py-3 font-bold sm:px-6">Business</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Owner</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Status</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Plan</th>
                  <th className="px-5 py-3 font-bold sm:px-6">Due date</th>
                  <th className="px-5 py-3 text-right font-bold sm:px-6">Members</th>
                </tr>
              </TableHead>
              <tbody>
                {result.items.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell>
                      <Link href={`/super-admin/businesses/${business.id}`} className="font-extrabold text-slate-900 hover:text-emerald-700">{business.name}</Link>
                      <p className="mt-1 text-xs text-slate-600">{business.country} · Created <DateText value={business.createdAt} /></p>
                      {business.adminHold ? <p className="mt-2 text-xs font-extrabold text-rose-700">Admin hold</p> : null}
                    </TableCell>
                    <TableCell><span className="font-bold text-slate-800">{business.createdByName}</span><p className="mt-1 text-xs text-slate-600">{business.createdByEmail}</p></TableCell>
                    <TableCell><StatusBadge value={business.status} /></TableCell>
                    <TableCell><span className="font-bold text-slate-800">{business.planName ?? "No subscription"}</span>{business.subscriptionStatus ? <div className="mt-1"><StatusBadge value={business.subscriptionStatus} /></div> : null}</TableCell>
                    <TableCell><DateText value={business.dueDate} />{business.amountMinor !== null && business.currency ? <p className="mt-1 text-xs font-bold text-slate-600"><Money amountMinor={business.amountMinor} currency={business.currency} /></p> : null}</TableCell>
                    <TableCell className="text-right font-bold">{business.memberCount}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </AdminTable>
            <Pagination page={result.page} totalPages={result.totalPages} basePath="/super-admin/businesses" params={filterParams} />
          </>
        ) : <EmptyState title="No businesses found" description="Try a broader search or clear one of the filters." />}
      </AdminPanel>
    </div>
  );
}
