import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerificationForm } from "@/app/(auth)/_components/resend-verification-form";

export const metadata: Metadata = {
  title: "Resend verification | Rungika",
  description: "Request a new Rungika account verification link",
};

export default function ResendVerificationPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Account verification
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Resend verification link
        </h2>
        <p className="text-sm text-slate-600">
          If your address belongs to an unverified account, a new one-time link will be sent.
        </p>
      </div>
      <ResendVerificationForm />
      <p className="text-center text-sm text-slate-600">
        <Link href="/sign-in" className="font-medium text-emerald-700 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </section>
  );
}
