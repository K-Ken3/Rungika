import Link from "next/link";

import { ArchiveRecordButton } from "@/components/business/archive-record-button";
import { TablesManager } from "@/components/business/tables-manager";
import { requireUser } from "@/lib/auth/authorization";
import { getTableWorkspace } from "@/lib/data/tables";

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function statusValue(value: string | string[] | undefined): "ACTIVE" | "ARCHIVED" | "ALL" {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "ARCHIVED" || normalized === "ALL" ? normalized : "ACTIVE";
}

export default async function TablesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { businessId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/tables`);
  const tableId = Array.isArray(query.table) ? query.table[0] : query.table;
  const search = Array.isArray(query.search) ? query.search[0] : query.search;
  const status = statusValue(query.status);
  const page = pageNumber(query.page);
  const data = await getTableWorkspace(user.id, businessId, tableId, { search, status, page });
  const base = `/business/${encodeURIComponent(businessId)}/tables`;
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (data.selectedTable) next.set("table", data.selectedTable.id);
    if (data.query.search) next.set("search", data.query.search);
    if (status !== "ACTIVE") next.set("status", status);
    next.set("page", String(nextPage));
    return `${base}?${next.toString()}`;
  };

  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Data workspace</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Tables & records</h1><p className="mt-2 text-slate-600">Build business-specific tables with typed fields and validated JSON records.</p></header>
      <TablesManager businessId={businessId} tables={data.tables} selectedTable={data.selectedTable} canCreateTable={data.canCreateTables} canEditFields={data.canManageFields} canDeleteTable={data.canDeleteTables} />
      {data.selectedTable ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-xl font-bold text-emerald-950">Records · {data.selectedTable.name}</h2><p className="mt-1 text-sm text-slate-600">{data.pagination.total} matching record{data.pagination.total === 1 ? "" : "s"}</p></div>
            <form className="flex flex-wrap items-end gap-3" method="get">
              <input type="hidden" name="table" value={data.selectedTable.id} />
              <label className="text-sm text-slate-700">Search<input className="mt-1 block rounded-lg border border-emerald-200 bg-slate-50 px-3 py-2 text-emerald-950" type="search" name="search" defaultValue={data.query.search} placeholder="Search text fields" /></label>
              <label className="text-sm text-slate-700">Status<select className="mt-1 block rounded-lg border border-emerald-200 bg-slate-50 px-3 py-2 text-emerald-950" name="status" defaultValue={status}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="ALL">All</option></select></label>
              <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-slate-800" type="submit">Apply</button>
            </form>
          </div>
          {data.selectedTable.fields.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{data.canManageFields ? "Add fields before creating records." : "No fields on this table are available to your role."}</p> : data.records.length === 0 ? <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">No records match this view.</p> : (
            <div className="overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-600"><tr><th className="px-4 py-3">Record</th>{data.selectedTable.fields.map((field) => <th key={field.id} className="px-4 py-3">{field.label}</th>)}<th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-emerald-100 bg-slate-50/40">{data.records.map((record) => <tr key={record.id} className="align-top"><td className="px-4 py-4"><p className="font-mono text-xs text-emerald-800">{record.id}</p><p className="mt-1 text-xs text-slate-600">{new Date(record.createdAt).toLocaleString()}</p></td>{data.selectedTable?.fields.map((field) => <td key={field.id} className="max-w-xs px-4 py-4 text-slate-700">{displayValue(record.data[field.key])}</td>)}<td className="px-4 py-4 text-slate-700">{record.status}</td><td className="px-4 py-4"><div className="flex flex-col items-start gap-3">{data.canEditRecords ? <Link className="text-sm font-semibold text-emerald-700" href={`${base}/${encodeURIComponent(data.selectedTable!.id)}/${encodeURIComponent(record.id)}`}>Edit</Link> : null}{data.canDeleteRecords && record.status === "ACTIVE" ? <ArchiveRecordButton businessId={businessId} tableId={data.selectedTable!.id} recordId={record.id} /> : null}</div></td></tr>)}</tbody>
              </table>
            </div>
          )}
          {data.pagination.pageCount > 1 ? <nav aria-label="Record pages" className="flex justify-between"><Link aria-disabled={data.pagination.page <= 1} className={`text-sm ${data.pagination.page <= 1 ? "pointer-events-none text-slate-600" : "text-emerald-700"}`} href={pageHref(Math.max(1, data.pagination.page - 1))}>Previous</Link><span className="text-sm text-slate-600">Page {data.pagination.page} of {data.pagination.pageCount}</span><Link aria-disabled={data.pagination.page >= data.pagination.pageCount} className={`text-sm ${data.pagination.page >= data.pagination.pageCount ? "pointer-events-none text-slate-600" : "text-emerald-700"}`} href={pageHref(Math.min(data.pagination.pageCount, data.pagination.page + 1))}>Next</Link></nav> : null}
        </section>
      ) : null}
    </div>
  );
}
