"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/actions/auth";
import { initialAuthState } from "@/lib/validation/auth";
import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

export function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialAuthState);

  return (
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <FormField
        id="sign-in-email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={state?.errors?.email?.[0]}
      />
      <FormField
        id="sign-in-password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={state?.errors?.password?.[0]}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/forgot-password"
          className="font-medium text-emerald-700 underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          href={callbackUrl ? `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-up"}
          className="font-medium text-emerald-700 underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </div>
    </form>
  );
}
