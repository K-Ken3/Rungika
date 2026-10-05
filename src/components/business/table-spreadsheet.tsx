"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importTableAction, type SpreadsheetActionState } from "@/actions/spreadsheet";
import { ActionMessage, ActionSubmitButton } from "@/components/business/form-controls";

const initialImportState: SpreadsheetActionState = { status: "idle" };

export function TableImportForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    importTableAction.bind(null, businessId),
    initialImportState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      if (state.redirectTo) {
        router.push(state.redirectTo);
      }
    }
  }, [state.status, state.redirectTo, router]);

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-5 grid gap-5 sm:grid-cols-2"
      aria-busy={pending}
    >
      <div className="sm:col-span-2">
        <label
          className="block text-sm font-medium text-emerald-950"
          htmlFor="import-file"
        >
          Spreadsheet file (.xlsx or .csv)
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".xlsx,.xlsm,.csv"
          required
          className="mt-2 block w-full rounded-lg border border-emerald-200 p-2 text-sm"
        />
        <p className="mt-2 text-xs text-slate-600">
          The first sheet is imported. Column types are detected automatically and
          every row becomes a record. Files are limited to 3.5 MB, 60 columns and
          5,000 rows.
        </p>
      </div>
      <div className="sm:col-span-2">
        <label
          className="block text-sm font-medium text-emerald-950"
          htmlFor="import-table-name"
        >
          Table name
        </label>
        <input
          id="import-table-name"
          name="tableName"
          type="text"
          maxLength={100}
          placeholder="Uses the sheet name when left blank"
          className="mt-2 block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <ActionMessage state={state} />
        <ActionSubmitButton pending={pending}>Import spreadsheet</ActionSubmitButton>
      </div>
    </form>
  );
}

function exportHref(tableId: string, format: "xlsx" | "csv") {
  const params = new URLSearchParams({
    format,
    scope: "all",
    status: "all",
  });
  return `/api/export/tables/${encodeURIComponent(tableId)}?${params.toString()}`;
}

export function TableExportMenu({
  tableId,
  canExport,
  tablePath,
}: {
  tableId: string;
  canExport: boolean;
  tablePath: string;
}) {
  const [copied, setCopied] = useState<"link" | null>(null);
  if (!canExport) {
    return null;
  }

  const copyLink = async () => {
    const url = new URL(window.location.origin + tablePath);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url.toString());
      } else {
        const field = document.createElement("textarea");
        field.value = url.toString();
        field.setAttribute("readonly", "");
        field.style.position = "absolute";
        field.style.left = "-9999px";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied("link");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={exportHref(tableId, "xlsx")}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-700"
      >
        Export .xlsx
      </a>
      <a
        href={exportHref(tableId, "csv")}
        className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-900 hover:bg-emerald-50"
      >
        Export .csv
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-900 hover:bg-emerald-50"
      >
        {copied === "link" ? "Link copied" : "Copy share link"}
      </button>
    </div>
  );
}