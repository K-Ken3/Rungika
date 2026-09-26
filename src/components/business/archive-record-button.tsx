"use client";

import { useActionState } from "react";
import {
  archiveRecordAction,
  initialBusinessActionState,
} from "@/actions/business";
import { ActionSubmitButton, ActionMessage } from "@/components/business/form-controls";

export function ArchiveRecordButton({
  businessId,
  tableId,
  recordId,
}: {
  businessId: string;
  tableId: string;
  recordId: string;
}) {
  const [state, action, pending] = useActionState(
    archiveRecordAction.bind(null, businessId),
    initialBusinessActionState,
  );
  return (
    <div className="space-y-2">
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="recordId" value={recordId} />
        <ActionSubmitButton pending={pending} className="border border-rose-200 bg-transparent text-rose-800 hover:bg-rose-50">
          Archive
        </ActionSubmitButton>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}
