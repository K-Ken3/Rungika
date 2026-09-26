import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/actions/auth";
import { BrandLogo } from "@/components/brand/logo";
import { requireUser } from "@/lib/auth/authorization";
import { getBusinessSelector } from "@/lib/data/business";

export default async function BusinessSelectorPage() {
  const user = await requireUser("/business");
  const businesses = await getBusinessSelector(user.id);
  if (businesses.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/business" className="rounded-xl bg-white px-4 py-3">
            <BrandLogo className="block w-40" priority />
          </Link>
          <form action={logout}>
            <button className="rounded-lg border border-emerald-100 px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50" type="submit">Sign out</button>
          </form>
        </header>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Welcome, {user.name}</p>
            <h1 className="mt-2 text-3xl font-bold text-emerald-950">Your businesses</h1>
            <p className="mt-2 text-slate-600">Only workspaces where you have an active membership are shown.</p>
          </div>
          <Link href="/onboarding" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-500">Register a business</Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <Link key={business.businessId} href={`/business/${encodeURIComponent(business.businessId)}`} className="group rounded-2xl border border-emerald-100 bg-white p-6 transition hover:border-emerald-600 hover:bg-white">
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-lg bg-white p-2"><BrandLogo className="block w-24" /></span>
                <span className="rounded-full border border-emerald-200 px-2.5 py-1 text-xs text-slate-700">{business.status.replaceAll("_", " ")}</span>
              </div>
              <h2 className="mt-6 text-xl font-bold text-emerald-950 group-hover:text-emerald-800">{business.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{business.role.replaceAll("_", " ")} · {business.subscriptionStatus?.replaceAll("_", " ") ?? "No subscription"}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
