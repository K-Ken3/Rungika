"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialAuthState,
  );

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      <FormField
        id="reset-password-password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        hint="Use at least 8 characters with a letter and a number."
        error={state?.errors?.password?.[0]}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Reset password</SubmitButton>
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
