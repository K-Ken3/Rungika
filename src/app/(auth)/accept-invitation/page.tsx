import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvitationForm } from "@/app/(auth)/_components/accept-invitation-form";
import { getCurrentUser, getInvitationPreview } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Accept invitation | Rungika",
  description: "Accept an invitation to join a Rungika business",
};

function messageClass(tone: "error" | "info") {
  return tone === "error"
    ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
    : "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800";
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  const currentUser = await getCurrentUser();
  const preview = token ? await getInvitationPreview(token, currentUser) : null;
  const signInHref = token
    ? `/sign-in?callbackUrl=${encodeURIComponent(`/accept-invitation?token=${token}`)}`
    : "/sign-in";
  const signUpHref = token
    ? `/sign-up?callbackUrl=${encodeURIComponent(`/accept-invitation?token=${token}`)}`
    : "/sign-up";

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Team invitation
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-950">
          Join a Rungika business
        </h2>
        <p className="text-sm text-slate-600">
          Accepting an invitation creates your membership with the role and unit chosen by the
          administrator who invited you.
        </p>
      </div>

      {!token ? (
        <p className={messageClass("error")}>
          This invitation link is incomplete. Ask the administrator to send a new invitation.
        </p>
      ) : !preview ? (
        <p className={messageClass("error")}>
          This invitation link is invalid or has expired. Ask the administrator to send a new
          invitation.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Business</dt>
                <dd className="text-right font-semibold text-emerald-950">
                  {preview.businessName}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="text-right font-semibold text-emerald-950">
                  {preview.roleName}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Invited email</dt>
                <dd className="text-right font-semibold text-emerald-950">{preview.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Expires</dt>
                <dd className="text-right font-semibold text-emerald-950">
                  {preview.expiresAt.toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {!preview.valid ? (
            <p className={messageClass("error")}>
              This invitation has already been used or has expired. Ask the administrator to send
              a new invitation.
            </p>
          ) : preview.alreadyMember ? (
            <p className={messageClass("info")}>
              You are already a member of {preview.businessName}.
            </p>
          ) : preview.emailMatches === false ? (
            <p className={messageClass("error")}>
              This invitation was sent to {preview.email}. Sign in with that email address to
              accept it.
            </p>
          ) : preview.emailMatches ? (
            <AcceptInvitationForm token={token} />
          ) : (
            <div className="space-y-4">
              <p className={messageClass("info")}>
                Sign in or create an account with {preview.email} to accept this invitation.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={signInHref}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Sign in
                </Link>
                <Link
                  href={signUpHref}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-emerald-800 hover:bg-slate-50"
                >
                  Create an account
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
