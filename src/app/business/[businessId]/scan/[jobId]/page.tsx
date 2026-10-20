import Link from "next/link";
import { notFound } from "next/navigation";

import { ScanReview } from "@/components/business/scan-review";
import { hasBusinessPermission, requireUser } from "@/lib/auth/authorization";
import { BusinessValidationError } from "@/lib/data/business";
import { getScanImportTargets, getScanJob } from "@/lib/data/scans";

export const maxDuration = 60;

export default async function ScanJobPage({
  params,
}: {
  params: Promise<{ businessId: string; jobId: string }>;
}) {
  const { businessId, jobId } = await params;
  const base = `/business/${encodeURIComponent(businessId)}`;
  const user = await requireUser(`${base}/scan/${jobId}`);

  let job: Awaited<ReturnType<typeof getScanJob>>;
  try {
    job = await getScanJob(user.id, businessId, jobId);
  } catch (error) {
    if (error instanceof BusinessValidationError) notFound();
    throw error;
  }

  if (job.status === "FAILED" || !job.result) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Scan to Table</p>
          <h1 className="mt-2 text-3xl font-bold text-emerald-950">Scan could not be read</h1>
        </header>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {job.error || "The document could not be processed."}
        </div>
        <p className="text-sm text-slate-600">
          Try a clearer, well-lit photo with the whole table visible, or a flatter scan.
        </p>
        <Link
          href={`${base}/scan`}
          className="inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-emerald-950 hover:bg-emerald-500"
        >
          Scan another document
        </Link>
      </div>
    );
  }

  const [canCreateTables, canCreateRecords, targets] = await Promise.all([
    hasBusinessPermission(user.id, businessId, "tables.create"),
    hasBusinessPermission(user.id, businessId, "records.create"),
    getScanImportTargets(user.id, businessId),
  ]);

  const defaultTableName = (job.result.title || "Scanned table").slice(0, 100);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Scan to Table</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">Review recognized table</h1>
        <p className="mt-2 text-slate-600">
          Correct any mistakes, then import the rows into a new or existing table.
        </p>
      </header>

      <ScanReview
        businessId={businessId}
        scanId={job.id}
        initialTitle={job.result.title}
        initialColumns={job.result.columns}
        initialRows={job.result.rows}
        warnings={job.result.warnings}
        provider={job.result.provider}
        targets={targets}
        defaultTableName={defaultTableName}
        canImport={canCreateTables && canCreateRecords}
      />
    </div>
  );
}
