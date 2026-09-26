import Link from "next/link";

import { requireUser } from "@/lib/auth/authorization";
import { getBusinessAuditLog } from "@/lib/data/business";

function pageValue(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AuditPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ page?: string | string[] }> }) {
  const { businessId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/audit`);
  const page = pageValue(query.page);
  const data = await getBusinessAuditLog(user.id, businessId, page);
  const base = `/business/${encodeURIComponent(businessId)}/audit`;
  return <div className="space-y-8"><header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Accountability</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Audit log</h1><p className="mt-2 text-slate-600">Immutable activity recorded for this business.</p></header><div className="overflow-x-auto rounded-2xl border border-emerald-100"><table className="w-full text-left text-sm"><thead className="bg-white text-slate-600"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Time</th></tr></thead><tbody className="divide-y divide-emerald-100">{data.entries.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-slate-600">No audit entries are visible.</td></tr> : data.entries.map((entry) => <tr key={entry.id}><td className="px-4 py-4 text-emerald-950">{entry.action}</td><td className="px-4 py-4 text-slate-700">{entry.entityType}<p className="mt-1 font-mono text-xs text-slate-600">{entry.entityId}</p></td><td className="px-4 py-4 text-slate-700">{entry.actorName ?? "System"}</td><td className="px-4 py-4 text-slate-700">{new Date(entry.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div><nav className="flex justify-between"><Link aria-disabled={data.page <= 1} className={data.page <= 1 ? "pointer-events-none text-slate-600" : "text-emerald-700"} href={`${base}?page=${Math.max(1, data.page - 1)}`}>Previous</Link><span className="text-sm text-slate-600">Page {data.page} of {data.pageCount} · {data.total} entries</span><Link aria-disabled={data.page >= data.pageCount} className={data.page >= data.pageCount ? "pointer-events-none text-slate-600" : "text-emerald-700"} href={`${base}?page=${Math.min(data.pageCount, data.page + 1)}`}>Next</Link></nav></div>;
}
