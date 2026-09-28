"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";

import { useActionState } from "react";
import {
  createUnitAction,
  deleteUnitAction,
  updateUnitAction,
} from "@/actions/business";
import {
  ActionMessage,
  ActionSubmitButton,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/business/form-controls";

type Unit = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  parentId: string | null;
  memberCount: number;
};

export function UnitManager({
  businessId,
  units,
  parents,
  canCreate,
  canEdit,
  canDelete,
}: {
  businessId: string;
  units: Unit[];
  parents: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [state, action, pending] = useActionState(
    createUnitAction.bind(null, businessId),
    initialBusinessActionState,
  );

  return (
    <div className="space-y-8">
      {canCreate ? (
        <section className="rounded-xl border border-emerald-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-emerald-950">Add unit</h2>
          <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" aria-busy={pending}>
            <input type="hidden" name="unitId" value="" />
            <TextField id="unit-name" name="name" label="Name" required error={state.fieldErrors?.name?.[0]} />
            <TextField
              id="unit-type"
              name="type"
              label="Type"
              defaultValue="DEPARTMENT"
              placeholder="DEPARTMENT, BRANCH, TEAM…"
              required
              error={state.fieldErrors?.type?.[0]}
            />
            <SelectField id="unit-parent" name="parentId" label="Parent unit" defaultValue="">
              <option value="">No parent</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <TextAreaField id="unit-description" name="description" label="Description" />
            </div>
            <div className="sm:col-span-2">
              <ActionMessage state={state} />
              <ActionSubmitButton pending={pending}>Create unit</ActionSubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-emerald-950">Units ({units.length})</h2>
        {units.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
            No units have been created for this business.
          </p>
        ) : (
          units.map((unit) => (
            <UnitRow
              key={unit.id}
              businessId={businessId}
              unit={unit}
              parents={parents}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))
        )}
      </section>
    </div>
  );
}

function UnitRow({
  businessId,
  unit,
  parents,
  canEdit,
  canDelete,
}: {
  businessId: string;
  unit: Unit;
  parents: Array<{ id: string; name: string }>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateUnitAction.bind(null, businessId),
    initialBusinessActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteUnitAction.bind(null, businessId),
    initialBusinessActionState,
  );

  return (
    <article className="rounded-xl border border-emerald-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-emerald-950">{unit.name}</h3>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
            {unit.type} · {unit.memberCount} members
          </p>
        </div>
        {canDelete ? (
          <form action={deleteAction} aria-busy={deletePending}>
            <input type="hidden" name="unitId" value={unit.id} />
            <button
              type="submit"
              disabled={deletePending || unit.memberCount > 0}
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          </form>
        ) : null}
      </div>
      {canEdit ? (
        <form action={updateAction} className="mt-5 grid gap-4 sm:grid-cols-2" aria-busy={updatePending}>
          <input type="hidden" name="unitId" value={unit.id} />
          <TextField id={`${unit.id}-name`} name="name" label="Name" defaultValue={unit.name} required />
          <TextField id={`${unit.id}-type`} name="type" label="Type" defaultValue={unit.type} required />
          <SelectField
            id={`${unit.id}-parent`}
            name="parentId"
            label="Parent unit"
            defaultValue={unit.parentId ?? ""}
          >
            <option value="">No parent</option>
            {parents
              .filter((parent) => parent.id !== unit.id)
              .map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
          </SelectField>
          <div className="sm:col-span-2">
            <TextAreaField
              id={`${unit.id}-description`}
              name="description"
              label="Description"
              defaultValue={unit.description ?? ""}
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <ActionMessage state={updateState} />
            <ActionSubmitButton pending={updatePending}>Save unit</ActionSubmitButton>
          </div>
        </form>
      ) : unit.description ? (
        <p className="mt-4 text-sm text-slate-600">{unit.description}</p>
      ) : null}
      <ActionMessage state={deleteState} />
    </article>
  );
}
