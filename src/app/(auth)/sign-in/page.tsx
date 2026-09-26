import type { Metadata } from "next";
import { SignInForm } from "@/app/(auth)/_components/sign-in-form";
import { safeCallbackPath } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Sign in | Rungika",
  description: "Sign in to your Rungika account",
};

type SignInSearchParams = Promise<{
  reset?: string | string[];
  verify?: string | string[];
  callbackUrl?: string | string[];
}>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SignInSearchParams;
}) {
  const query = await searchParams;
  const passwordWasReset = query.reset === "success";
  const verificationState = Array.isArray(query.verify) ? query.verify[0] : query.verify;
  const callbackUrl = safeCallbackPath(
    Array.isArray(query.callbackUrl) ? query.callbackUrl[0] : query.callbackUrl,
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Welcome back
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Sign in to your workspace
        </h2>
        <p className="text-sm text-slate-600">
          Keep your business operations, billing, and team access in one place.
        </p>
      </div>
      {passwordWasReset ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
        >
          Your password has been reset. Sign in with your new password.
        </p>
      ) : null}
      {verificationState === "sent" ? (
        <div
          role="status"
          className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          <p>Check your email for the verification link.</p>
          <p className="text-amber-700">
            Delivery can take a minute, and messages from new senders are often filtered. Look in
            your spam or junk folder, or{" "}
            <a className="font-semibold underline" href="/resend-verification">
              request another link
            </a>
            .
          </p>
        </div>
      ) : null}
      {verificationState === "unavailable" ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          Your account was created, but verification email could not be delivered. Configure the email provider and request a new link.
        </p>
      ) : null}
      {verificationState === "required" ? (
        <div
          role="alert"
          className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
        >
          <p>Verify your email before signing in.</p>
          <p className="text-amber-700">
            Messages from new senders are often filtered, so check your spam or junk folder first.{" "}
            <a className="font-semibold underline" href="/resend-verification">
              Request a new link
            </a>
            .
          </p>
        </div>
      ) : null}
      <SignInForm callbackUrl={callbackUrl ?? undefined} />
    </section>
  );
}
