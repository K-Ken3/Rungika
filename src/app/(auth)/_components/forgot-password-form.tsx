"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function ForgotPasswordForm({
  providerAvailable,
}: {
  providerAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    forgotPassword,
    initialAuthState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <FormField
        id="forgot-password-email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={state?.errors?.email?.[0]}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>
        {providerAvailable ? "Send reset link" : "Request password recovery"}
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        <Link
          href="/sign-in"
          className="font-medium text-emerald-700 underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
