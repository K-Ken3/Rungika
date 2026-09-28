"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";

import { useActionState } from "react";
import {
  createRoleAction,
  updateRoleAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";

type CatalogItem = {
  key: string;
  module: string;
  action: string;
  description: string;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  memberCount: number;
  invitationCount: number;
  permissions: string[];
};

export function RolesManager({
  businessId,
  roles,
  catalog,
}: {
  businessId: string;
  roles: Role[];
  catalog: CatalogItem[];
}) {
  const [state, action, pending] = useActionState(
    createRoleAction.bind(null, businessId), initialBusinessActionState);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-emerald-100 bg-white p-5">
        <h2 className="text-lg font-semibold text-emerald-950">Create a custom role</h2>
        <p className="mt-2 text-sm text-slate-600">
          Custom roles are scoped to this business. System roles are protected from edits.
        </p>
        <form action={action} className="mt-5 space-y-5" aria-busy={pending}>
          <input type="hidden" name="roleId" value="" />
          <TextField id="role-name" name="name" label="Role name" required error={state.fieldErrors?.name?.[0]} />
          <TextAreaField id="role-description" name="description" label="Description" />
          <PermissionPicker catalog={catalog} />
          <div className="space-y-3">
            <ActionMessage state={state} />
            <ActionSubmitButton pending={pending}>Create role</ActionSubmitButton>
          </div>
        </form>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-emerald-950">Roles ({roles.length})</h2>
        {roles.map((role) => (
          <RoleRow key={role.id} businessId={businessId} role={role} catalog={catalog} />
        ))}
      </section>
    </div>
  );
}

function PermissionPicker({
  catalog,
  selected = [],
  disabled = false,
}: {
  catalog: CatalogItem[];
  selected?: string[];
  disabled?: boolean;
}) {
  const grouped = catalog.reduce<Record<string, CatalogItem[]>>((groups, item) => {
    groups[item.module] ??= [];
    groups[item.module].push(item);
    return groups;
  }, {});
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="text-sm font-medium text-slate-800">Permissions</legend>
      {Object.entries(grouped).map(([module, items]) => (
        <div key={module} className="rounded-lg border border-emerald-100 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {module}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <label key={item.key} className="flex gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="permissionKeys"
                  value={item.key}
                  defaultChecked={selected.includes(item.key)}
                  className="mt-1 h-4 w-4 rounded border-emerald-200 bg-white text-emerald-700 focus:ring-emerald-500"
                />
                <span>
                  <span className="block">{item.action.toLowerCase()}</span>
                  <span className="block text-xs text-slate-600">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function RoleRow({
  businessId,
  role,
  catalog,
}: {
  businessId: string;
  role: Role;
  catalog: CatalogItem[];
}) {
  const [state, action, pending] = useActionState(
    updateRoleAction.bind(null, businessId), initialBusinessActionState);

  if (role.isSystem) {
    return (
      <article className="rounded-xl border border-emerald-100 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="font-semibold text-emerald-950">{role.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{role.description}</p>
          </div>
          <span className="rounded-full border border-emerald-600 px-3 py-1 text-xs text-emerald-800">
            System role · {role.memberCount} members
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {role.permissions.map((permission) => (
            <span key={permission} className="rounded bg-emerald-50 px-2 py-1 text-xs text-slate-700">
              {permission}
            </span>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-5">
      <form action={action} className="space-y-5" aria-busy={pending}>
        <input type="hidden" name="roleId" value={role.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={`${role.id}-name`} name="name" label="Role name" defaultValue={role.name} required />
          <TextAreaField id={`${role.id}-description`} name="description" label="Description" defaultValue={role.description ?? ""} />
        </div>
        <PermissionPicker catalog={catalog} selected={role.permissions} />
        <div className="space-y-3">
          <ActionMessage state={state} />
          <ActionSubmitButton pending={pending}>Save role</ActionSubmitButton>
        </div>
      </form>
    </article>
  );
}
