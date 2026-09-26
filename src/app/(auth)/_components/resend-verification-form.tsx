"use client";

import { useActionState } from "react";
import { resendEmailVerification } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function ResendVerificationForm() {
  const [state, formAction, pending] = useActionState(
    resendEmailVerification,
    initialAuthState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <FormField
        id="resend-verification-email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={state?.errors?.email?.[0]}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Send verification link</SubmitButton>
    </form>
  );
}
