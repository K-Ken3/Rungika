import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";
import { getBusinessAccess } from "@/lib/data/business";

export default async function RestrictedPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/restricted`);
  const access = await getBusinessAccess(user.id, businessId);
  if (access.hasPaidAccess && !access.business.adminHold) {
    redirect(`/business/${encodeURIComponent(businessId)}`);
  }
  const base = `/business/${encodeURIComponent(businessId)}`;
  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Operational access restricted</p>
        <h1 className="mt-3 text-3xl font-bold text-emerald-950">{access.business.name}</h1>
        <p className="mt-4 leading-7 text-amber-800">
          {access.business.adminHold
            ? "An administrator has placed this business on hold. You can still manage billing, submit a payment claim, read notifications, update the business profile, and contact support."
            : access.business.status === "PAUSED"
              ? `This workspace is paused${access.business.pauseReason ? `: ${access.business.pauseReason}` : "."} Billing, payment claims, notifications, profile, and support remain available.`
              : "The initial subscription payment is required before operational data, people, units, and table features can be used."}
        </p>
        {access.subscription ? (
          <dl className="mt-6 grid gap-4 rounded-xl border border-amber-200 bg-slate-50/40 p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-600">Status</dt><dd className="mt-1 font-semibold text-emerald-950">{access.business.status.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-slate-600">Due date</dt><dd className="mt-1 font-semibold text-emerald-950">{new Date(access.subscription.dueDate).toLocaleString()}</dd></div>
            <div><dt className="text-slate-600">Grace ends</dt><dd className="mt-1 font-semibold text-emerald-950">{access.subscription.graceEndsAt ? new Date(access.subscription.graceEndsAt).toLocaleString() : "Not in grace period"}</dd></div>
          </dl>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`${base}/billing`} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-emerald-950">Open billing</Link>
          <Link href={`${base}/support`} className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm text-slate-800">Contact support</Link>
          <Link href="/business" className="rounded-lg px-4 py-2.5 text-sm text-slate-700">Switch workspace</Link>
        </div>
      </section>
    </div>
  );
}
