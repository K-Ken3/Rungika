import { notFound } from "next/navigation";

import { RecordForm } from "@/components/business/record-form";
import { hasBusinessPermission, requireUser } from "@/lib/auth/authorization";
import { BusinessValidationError } from "@/lib/data/business";
import { getCustomRecord } from "@/lib/data/tables";

export default async function EditRecordPage({ params }: { params: Promise<{ businessId: string; tableId: string; recordId: string }> }) {
  const { businessId, tableId, recordId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/tables/${encodeURIComponent(tableId)}`);
  let data: Awaited<ReturnType<typeof getCustomRecord>>;
  try {
    data = await getCustomRecord({ userId: user.id, businessId, tableId, recordId });
  } catch (error) {
    if (error instanceof BusinessValidationError) notFound();
    throw error;
  }
  if (!data.record) notFound();
  const canEdit = await hasBusinessPermission(user.id, businessId, "records.edit");
  const rawData = data.record.data;
  const recordData = typeof rawData === "object" && rawData !== null && !Array.isArray(rawData) ? rawData as Record<string, unknown> : {};
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-emerald-950">View record</h1>
          <p className="mt-1 text-sm text-slate-600">{data.table.name}</p>
        </header>
        <dl className="divide-y divide-emerald-100 overflow-hidden rounded-xl border border-emerald-100">
          {data.table.fields.map((field) => (
            <div key={field.id} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
              <dt className="text-sm text-slate-600">{field.label}</dt>
              <dd className="text-sm text-emerald-950 sm:col-span-2">
                {formatRecordValue(recordData[field.key])}
              </dd>
            </div>
          ))}
        </dl>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You can view this record but not edit it. Ask a business administrator for the records
          edit permission.
        </p>
      </div>
    );
  }
  return <RecordForm businessId={businessId} tableId={tableId} tableName={data.table.name} fields={data.table.fields} recordId={recordId} recordData={recordData} />;
}

function formatRecordValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
