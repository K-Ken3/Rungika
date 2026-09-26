import Link from "next/link";

import { SupportManager } from "@/components/business/support-manager";
import { requireUser } from "@/lib/auth/authorization";
import { getBusinessSupportCases } from "@/lib/data/business";

export default async function SupportPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/support`);
  const data = await getBusinessSupportCases(user.id, businessId);
  return <div className="space-y-8"><header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Assistance</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Support</h1><p className="mt-2 text-slate-600">Open a business-scoped support case. Only cases you submitted are shown.</p></header><SupportManager businessId={businessId} cases={data.cases} contact={data.contact} /><Link href={`/business/${encodeURIComponent(businessId)}/notifications`} className="inline-block text-sm text-emerald-700">Review support notifications →</Link></div>;
}
