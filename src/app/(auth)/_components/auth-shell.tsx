import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/public-header";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,163,106,0.14),_transparent_38%),linear-gradient(180deg,#f7fbf8_0%,#ffffff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl py-6 sm:py-10">
          <div className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_18px_46px_rgba(11,126,80,0.08)] sm:p-7">
            <div className="mx-auto max-w-md">{children}</div>
          </div>
        </div>
      </main>
    </>
  );
}
