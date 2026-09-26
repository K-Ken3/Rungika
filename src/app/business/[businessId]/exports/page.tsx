import Link from "next/link";

import { requireUser, hasBusinessPermission } from "@/lib/auth/authorization";
import { getTableWorkspace } from "@/lib/data/tables";

export default async function ExportsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/exports`);
  const [data, canExport] = await Promise.all([
    getTableWorkspace(user.id, businessId, undefined, { status: "ALL" }),
    hasBusinessPermission(user.id, businessId, "records.export"),
  ]);
  return <div className="space-y-8"><header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Data portability</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Exports</h1><p className="mt-2 text-slate-600">Generate formula-safe CSV files for a single table. Exports are tenant-scoped and capped per page.</p></header>{!canExport ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">Your role cannot export records.</p> : data.tables.length === 0 ? <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">No custom tables are available to export.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.tables.map((table) => <article key={table.id} className="rounded-2xl border border-emerald-100 bg-white p-5"><h2 className="text-lg font-bold text-emerald-950">{table.name}</h2><p className="mt-2 text-sm text-slate-600">{table.fieldCount} fields · {table.recordCount} records</p><a className="mt-5 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-emerald-950" href={`/api/export/tables/${encodeURIComponent(table.id)}?status=all&pageSize=100&page=1`}>Download CSV</a></article>)}</div>}<Link href={`/business/${encodeURIComponent(businessId)}/tables`} className="inline-block text-sm text-emerald-700">Back to tables →</Link></div>;
}
