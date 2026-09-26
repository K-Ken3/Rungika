import type { Metadata } from "next";
import { SignUpForm } from "@/app/(auth)/_components/sign-up-form";
import { safeCallbackPath } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Create account | Rungika",
  description: "Create a Rungika account",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const query = await searchParams;
  const callbackUrl = safeCallbackPath(
    Array.isArray(query.callbackUrl) ? query.callbackUrl[0] : query.callbackUrl,
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Start here
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Create your account
        </h2>
        <p className="text-sm text-slate-600">
          Start setting up your Rungika workspace.
        </p>
      </div>
      <SignUpForm callbackUrl={callbackUrl ?? undefined} />
      <p className="text-center text-xs text-slate-500">
        Administrator accounts are provisioned internally.
      </p>
    </section>
  );
}
