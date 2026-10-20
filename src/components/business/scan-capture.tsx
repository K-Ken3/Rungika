"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { createScanAction, type ScanActionState } from "@/actions/scan";
import { ActionMessage, ActionSubmitButton } from "@/components/business/form-controls";
import { MAX_SCAN_BYTES, MAX_SCAN_DIMENSION, MAX_SCAN_UPLOAD_LABEL } from "@/lib/ocr/limits";

const initialState: ScanActionState = { status: "idle" };

async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_SCAN_DIMENSION / longest);
    if (scale >= 1 && file.size <= MAX_SCAN_BYTES) {
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) {
      return file;
    }
    const name = `${file.name.replace(/\.[^.]+$/, "") || "scan"}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ScanCaptureForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createScanAction.bind(null, businessId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      return;
    }
    if (state.status === "error" && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.status, state.redirectTo, router]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    setPreparing(true);
    const processed = await downscaleImage(file);
    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(processed);
      inputRef.current.files = transfer.files;
    }
    setPreview(processed.type.startsWith("image/") ? URL.createObjectURL(processed) : null);
    setPreparing(false);
  };

  return (
    <form ref={formRef} action={action} className="mt-4 grid gap-4" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-6 text-center text-sm text-emerald-900 hover:bg-emerald-50">
          <span className="font-semibold">Take a photo</span>
          <span className="mt-1 text-xs text-slate-600">Uses your phone camera</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFile}
          />
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-6 text-center text-sm text-emerald-900 hover:bg-emerald-50">
          <span className="font-semibold">Upload a file</span>
          <span className="mt-1 text-xs text-slate-600">Photo, scan or PDF</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={handleFile}
          />
        </label>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {preview ? (
        <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Scan preview" className="max-h-72 w-full object-contain" />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-emerald-200 bg-white px-3 py-6 text-center text-xs text-slate-600">
          Nothing selected yet. Choose how to capture the document above.
        </p>
      )}

      <div>
        <label htmlFor="scan-hint" className="block text-sm font-medium text-emerald-950">
          Optional hint
        </label>
        <input
          id="scan-hint"
          name="hint"
          type="text"
          maxLength={300}
          placeholder="e.g. stock sheet, or sales for March"
          className="mt-2 block w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-slate-600">
          Photos are compressed before upload (max {MAX_SCAN_UPLOAD_LABEL}). Your document is sent to the
          configured vision service to read the table, then stored privately under your business.
        </p>
      </div>

      <ActionMessage state={state} />
      <div>
        <ActionSubmitButton pending={pending || preparing}>
          {preparing ? "Preparing image…" : "Scan to table"}
        </ActionSubmitButton>
      </div>
    </form>
  );
}
