import type { Metadata } from "next";
import Link from "next/link";

import { VerifyEmailForm } from "@/app/(auth)/_components/verify-email-form";
import { safeCallbackPath } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Verify email | Rungika",
  description: "Verify your Rungika account email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; callbackUrl?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  const callbackUrl = safeCallbackPath(
    Array.isArray(query.callbackUrl) ? query.callbackUrl[0] : query.callbackUrl,
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Account verification
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Confirm your email
        </h2>
      <p className="text-sm text-slate-600">
        Verify your email before signing in to your workspace. The link expires in 24 hours and can
        only be used once.
      </p>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        No email yet? New senders are often filtered, so check your spam or junk folder before
        requesting another link.
      </p>
      </div>
      {token ? (
        <VerifyEmailForm token={token} callbackUrl={callbackUrl ?? undefined} />
      ) : (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          This verification link is incomplete. Request a new link to continue.
        </p>
      )}
      <p className="text-center text-sm text-slate-600">
        <Link href="/resend-verification" className="font-medium text-emerald-700 underline-offset-4 hover:underline">
          Request a new link
        </Link>
      </p>
    </section>
  );
}
