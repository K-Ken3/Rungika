import { notFound } from "next/navigation";

import { RecordForm } from "@/components/business/record-form";
import { requireUser } from "@/lib/auth/authorization";
import { BusinessValidationError } from "@/lib/data/business";
import { getCustomRecord } from "@/lib/data/tables";

export default async function NewRecordPage({ params }: { params: Promise<{ businessId: string; tableId: string }> }) {
  const { businessId, tableId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/tables/${encodeURIComponent(tableId)}/new`);
  let data: Awaited<ReturnType<typeof getCustomRecord>>;
  try {
    data = await getCustomRecord({ userId: user.id, businessId, tableId });
  } catch (error) {
    if (error instanceof BusinessValidationError) notFound();
    throw error;
  }
  return <RecordForm businessId={businessId} tableId={tableId} tableName={data.table.name} fields={data.table.fields} />;
}
