import { UnitManager } from "@/components/business/unit-manager";
import { requireUser, hasBusinessPermission } from "@/lib/auth/authorization";
import { getBusinessUnits } from "@/lib/data/business";

export default async function UnitsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/units`);
  const [data, canCreate, canEdit, canDelete] = await Promise.all([
    getBusinessUnits(user.id, businessId),
    hasBusinessPermission(user.id, businessId, "units.create"),
    hasBusinessPermission(user.id, businessId, "units.edit"),
    hasBusinessPermission(user.id, businessId, "units.delete"),
  ]);
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Organization</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Units</h1><p className="mt-2 text-slate-600">Departments, branches, teams, and other operational groups.</p></header>
      <UnitManager businessId={businessId} units={data.units} parents={data.parents} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
