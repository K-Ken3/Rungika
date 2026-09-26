import type { Metadata } from "next";
import { isEmailProviderConfigured } from "@/lib/auth";
import { PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE } from "@/lib/validation/auth";
import { ForgotPasswordForm } from "@/app/(auth)/_components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password | Rungika",
  description: "Request a Rungika password reset",
};

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const providerAvailable = isEmailProviderConfigured();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Recover access
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Reset your password
        </h2>
        <p className="text-sm text-slate-600">
          Enter your email address and we&apos;ll send reset instructions if an account exists.
        </p>
      </div>
      {providerAvailable ? null : (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          {PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE}
        </p>
      )}
      <ForgotPasswordForm providerAvailable={providerAvailable} />
    </section>
  );
}
