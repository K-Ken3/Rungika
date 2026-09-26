"use client";

import { useActionState } from "react";
import { verifyEmail } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function VerifyEmailForm({
  token,
  callbackUrl,
}: {
  token: string;
  callbackUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(verifyEmail, initialAuthState);

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Verify email</SubmitButton>
    </form>
  );
}
