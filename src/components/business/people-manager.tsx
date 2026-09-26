"use client";

import { useActionState } from "react";
import {
  initialBusinessActionState,
  invitePersonAction,
  updatePersonAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  SelectField,
  TextField,
} from "@/components/business/form-controls";

type Person = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  unitId: string | null;
  unitName: string | null;
  jobTitle: string | null;
  startDate: string | null;
};

type Invitation = {
  id: string;
  email: string;
  phone: string | null;
  roleName: string;
  status: string;
  expiresAt: string;
};

export function PeopleManager({
  businessId,
  people,
  invitations,
  roles,
  units,
  canInvite,
  canEdit,
}: {
  businessId: string;
  people: Person[];
  invitations: Invitation[];
  roles: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string }>;
  canInvite: boolean;
  canEdit: boolean;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    invitePersonAction.bind(null, businessId),
    initialBusinessActionState,
  );

  return (
    <div className="space-y-8">
      {canInvite ? (
        <section className="rounded-xl border border-emerald-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-emerald-950">Invite a person</h2>
          <p className="mt-2 text-sm text-amber-800">
            The invitation link is emailed to the address you enter and expires after 7 days. It
            only works for that address, and the recipient must verify their email first.
          </p>
          <form action={inviteAction} className="mt-5 grid gap-5 sm:grid-cols-2" aria-busy={invitePending}>
            <TextField
              id="invite-email"
              name="email"
              type="email"
              label="Email address"
              required
              error={inviteState.fieldErrors?.email?.[0]}
            />
            <TextField id="invite-phone" name="phone" type="tel" label="Phone" />
            <SelectField id="invite-role" name="roleId" label="Role" required defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
            <SelectField id="invite-unit" name="unitId" label="Unit" defaultValue="">
              <option value="">No unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <ActionMessage state={inviteState} />
              <ActionSubmitButton pending={invitePending}>Record invitation</ActionSubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-emerald-950">People ({people.length})</h2>
        <div className="mt-4 space-y-4">
          {people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
              No people are visible for this business.
            </p>
          ) : (
            people.map((person) => (
              <PersonRow
                key={person.membershipId}
                businessId={businessId}
                person={person}
                roles={roles}
                units={units}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-emerald-950">Invitations ({invitations.length})</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="px-4 py-3 text-slate-800">{invitation.email}</td>
                  <td className="px-4 py-3 text-slate-600">{invitation.roleName}</td>
                  <td className="px-4 py-3 text-slate-600">{invitation.status}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(invitation.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PersonRow({
  businessId,
  person,
  roles,
  units,
  canEdit,
}: {
  businessId: string;
  person: Person;
  roles: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    updatePersonAction.bind(null, businessId),
    initialBusinessActionState,
  );

  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold text-emerald-950">{person.name}</h3>
          <p className="text-sm text-slate-600">{person.email}</p>
        </div>
        <span className="rounded-full border border-emerald-200 px-3 py-1 text-xs text-slate-700">
          {person.role} · {person.status}
        </span>
      </div>
      {canEdit ? (
        <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2" aria-busy={pending}>
          <input type="hidden" name="membershipId" value={person.membershipId} />
          <SelectField id={`${person.membershipId}-role`} name="roleId" label="Role" defaultValue={roles.find((role) => role.name === person.role)?.id ?? ""}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          <SelectField id={`${person.membershipId}-unit`} name="unitId" label="Unit" defaultValue={person.unitId ?? ""}>
            <option value="">No unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id={`${person.membershipId}-job`}
            name="jobTitle"
            label="Job title"
            defaultValue={person.jobTitle ?? ""}
          />
          <TextField
            id={`${person.membershipId}-start`}
            name="startDate"
            type="date"
            label="Start date"
            defaultValue={person.startDate ? person.startDate.slice(0, 10) : ""}
          />
          <SelectField id={`${person.membershipId}-status`} name="status" label="Membership status" defaultValue={person.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
          <div className="space-y-3 sm:col-span-2">
            <ActionMessage state={state} />
            <ActionSubmitButton pending={pending}>Save membership</ActionSubmitButton>
          </div>
        </form>
      ) : null}
    </article>
  );
}
