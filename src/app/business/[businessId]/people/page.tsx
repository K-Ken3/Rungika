import { PeopleManager } from "@/components/business/people-manager";
import { requireUser } from "@/lib/auth/authorization";
import { hasBusinessPermission } from "@/lib/auth/authorization";
import { getPeople } from "@/lib/data/business";

export default async function PeoplePage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ saved?: string; delivery?: string; joined?: string }> }) {
  const { businessId } = await params;
  const { delivery, joined } = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/people`);
  const [people, canInvite, canEdit] = await Promise.all([
    getPeople(user.id, businessId),
    hasBusinessPermission(user.id, businessId, "people.create"),
    hasBusinessPermission(user.id, businessId, "people.edit"),
  ]);
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Organization</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">People</h1><p className="mt-2 text-slate-600">Memberships, invitations, roles, units, and employment details for this business.</p></header>
      {joined ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">You joined {joined}. Your membership is active.</div> : null}
      {delivery === "unavailable" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">The invitation email could not be delivered, so this invitation was closed. Configure the email provider, then send a new invitation.</div> : null}
      <PeopleManager businessId={businessId} people={people.people} invitations={people.invitations} roles={people.roles} units={people.units} canInvite={canInvite} canEdit={canEdit} />
      <div className="rounded-xl border border-emerald-100 p-4 text-sm"><a className="font-semibold text-emerald-700" href={`/business/${encodeURIComponent(businessId)}/roles`}>Review role permissions →</a></div>
    </div>
  );
}
