import { TablesManager } from "@/components/business/tables-manager";
import { requireUser } from "@/lib/auth/authorization";
import { getTableWorkspace } from "@/lib/data/tables";

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function statusValue(value: string | string[] | undefined): "ACTIVE" | "ARCHIVED" | "ALL" {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "ARCHIVED" || normalized === "ALL" ? normalized : "ACTIVE";
}

function one(query: Record<string, string | string[] | undefined>, key: string, limit = 100) {
  const raw = Array.isArray(query[key]) ? query[key][0] : query[key];
  return (raw ?? "").trim().slice(0, limit);
}

export default async function TablesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { businessId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/tables`);
  const tableId = Array.isArray(query.table) ? query.table[0] : query.table;
  const search = Array.isArray(query.search) ? query.search[0] : query.search;
  const status = statusValue(query.status);
  const page = pageNumber(query.page);
  const order = one(query, "order", 4) === "asc" ? ("asc" as const) : ("desc" as const);
  const data = await getTableWorkspace(user.id, businessId, tableId, {
    search,
    status,
    page,
    sort: one(query, "sort", 64),
    order,
    filterKey: one(query, "fkey", 64),
    filterValue: one(query, "fval", 100),
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Data workspace</p>
        <h1 className="mt-2 text-3xl font-bold text-emerald-950">Tables</h1>
        <p className="mt-2 text-slate-600">
          Build spreadsheet-style tables with typed columns, add rows inline, and export or share any sheet.
        </p>
      </header>
      <TablesManager
        businessId={businessId}
        tables={data.tables}
        selectedTable={data.selectedTable}
        records={data.records}
        pagination={data.pagination}
        query={data.query}
        canCreateTable={data.canCreateTables}
        canEditFields={data.canManageFields}
        canDeleteTable={data.canDeleteTables}
        canExportRecords={data.canExportRecords}
        canCreateRecords={data.canCreateRecords}
        canEditRecords={data.canEditRecords}
        canDeleteRecords={data.canDeleteRecords}
      />
    </div>
  );
}
