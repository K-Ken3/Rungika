import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/app/(auth)/_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password | Rungika",
  description: "Choose a new Rungika password",
};

type ResetPasswordSearchParams = Promise<{
  token?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: ResetPasswordSearchParams;
}) {
  const query = await searchParams;
  const token = firstValue(query.token);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Secure access
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Choose a new password
        </h2>
        <p className="text-sm text-slate-600">
          Reset links are single-use and expire after 30 minutes.
        </p>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5" role="alert">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            Request a new reset link
          </Link>
        </div>
      )}
    </section>
  );
}
