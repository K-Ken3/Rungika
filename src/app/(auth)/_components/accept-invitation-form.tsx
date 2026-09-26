"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialAuthState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Join the business</SubmitButton>
    </form>
  );
}
