import type { AuthActionState } from "@/lib/validation/auth";

export function FormMessage({ state }: { state?: AuthActionState }) {
  if (!state?.message) {
    return null;
  }

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-xl border px-3 py-2.5 text-sm ${
        state.status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.message}
    </p>
  );
}
