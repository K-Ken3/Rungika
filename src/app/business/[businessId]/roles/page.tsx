import { RolesManager } from "@/components/business/roles-manager";
import { requireUser } from "@/lib/auth/authorization";
import { getBusinessRoles } from "@/lib/data/business";

export default async function RolesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { businessId } = await params;
  await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/roles`);
  const data = await getBusinessRoles(user.id, businessId);
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Access control</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Roles & permissions</h1><p className="mt-2 text-slate-600">System roles are protected. Custom roles remain isolated to this business.</p></header>
      <RolesManager businessId={businessId} roles={data.roles} catalog={data.catalog} />
    </div>
  );
}
