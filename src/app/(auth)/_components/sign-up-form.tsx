"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function SignUpForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(signUp, initialAuthState);

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <FormField
        id="sign-up-name"
        name="name"
        type="text"
        label="Full name"
        autoComplete="name"
        required
        error={state?.errors?.name?.[0]}
      />
      <FormField
        id="sign-up-email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={state?.errors?.email?.[0]}
      />
      <FormField
        id="sign-up-password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        hint="Use at least 8 characters with a letter and a number."
        error={state?.errors?.password?.[0]}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={callbackUrl ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-in"}
          className="font-semibold text-emerald-700 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
