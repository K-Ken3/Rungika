import Link from "next/link";

import { ScanCaptureForm } from "@/components/business/scan-capture";
import { hasBusinessPermission, requireUser } from "@/lib/auth/authorization";
import { listScanJobs } from "@/lib/data/scans";
import { isOcrConfigured } from "@/lib/ocr";

export const maxDuration = 60;

function statusStyle(status: string) {
  if (status === "REVIEW") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "IMPORTED") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "FAILED") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default async function ScanPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const base = `/business/${encodeURIComponent(businessId)}`;
  const user = await requireUser(`${base}/scan`);
  const [canCreate, jobs] = await Promise.all([
    hasBusinessPermission(user.id, businessId, "tables.create"),
    listScanJobs(user.id, businessId),
  ]);
  const configured = isOcrConfigured();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Scan to Table</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">Scan a handwritten record</h1>
        <p className="mt-2 text-slate-600">
          Photograph or upload a handwritten or printed sheet. Rungika reads the table, flags anything unclear,
          and lets you review it before saving it as a spreadsheet.
        </p>
      </header>

      {!configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Scanning is not configured on this server.</p>
          <p className="mt-1">
            Add a vision provider key (<code className="rounded bg-white px-1">GEMINI_API_KEY</code> or{" "}
            <code className="rounded bg-white px-1">OPENAI_API_KEY</code>) to enable it. Uploads and review still work
            once a key is present.
          </p>
        </div>
      ) : null}

      {canCreate ? (
        <section className="rounded-2xl border border-emerald-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-emerald-950">New scan</h2>
          <ScanCaptureForm businessId={businessId} />
        </section>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You do not have permission to create scans. Ask an owner or manager for table permissions.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-emerald-950">Recent scans</h2>
        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No scans yet. Capture a document above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-emerald-100 overflow-hidden rounded-xl border border-emerald-100 bg-white">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`${base}/scan/${encodeURIComponent(job.id)}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-emerald-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-emerald-950">
                      {job.result?.title || job.sourceName || "Scanned document"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleString()} · {job.provider ?? "—"}
                      {job.result ? ` · ${job.result.rows.length} row(s)` : ""}
                    </span>
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(job.status)}`}>
                    {job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
