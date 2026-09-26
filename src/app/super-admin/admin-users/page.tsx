import { requireAdmin } from "@/lib/auth/authorization";
import { listAdminUsers, requireActiveAdminMembership } from "@/lib/data/admin";
import {
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  DateText,
  EmptyState,
  Notice,
  PanelHeading,
  StatusBadge,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/admin/ui";

export default async function AdminUsersPage() {
  const user = await requireAdmin();
  await requireActiveAdminMembership(user);
  const admins = await listAdminUsers();

  return (
    <div>
      <AdminPageHeader eyebrow="Access visibility" title="Admin users" description="Read-only visibility into administrator memberships and their current active state. This workspace does not create or invite administrators." />
      <Notice tone="info">Administrator membership changes must be performed through the controlled access process; no public admin signup or creation form is exposed here.</Notice>
      <AdminPanel className="mt-6">
        <PanelHeading title="Administrator memberships" description={`${admins.length} membership${admins.length === 1 ? "" : "s"}`} />
        {admins.length ? (
          <AdminTable label="Administrator users">
            <TableHead><tr><th className="px-5 py-3 font-bold sm:px-6">Administrator</th><th className="px-5 py-3 font-bold sm:px-6">Role</th><th className="px-5 py-3 font-bold sm:px-6">Account</th><th className="px-5 py-3 font-bold sm:px-6">Businesses</th><th className="px-5 py-3 font-bold sm:px-6">Created</th></tr></TableHead>
            <tbody>
              {admins.map((admin) => (
                <TableRow key={admin.membershipId}>
                  <TableCell><span className="font-extrabold text-slate-800">{admin.name}</span><p className="mt-1 text-xs text-slate-600">{admin.email}</p></TableCell>
                  <TableCell><span className="font-bold text-slate-800">{admin.role.replaceAll("_", " ")}</span></TableCell>
                  <TableCell><StatusBadge value={admin.active ? "ACTIVE" : "INACTIVE"} /><span className="ml-2 text-xs text-slate-600">{admin.userStatus}</span></TableCell>
                  <TableCell>{admin.lastBusinessCount}</TableCell>
                  <TableCell><DateText value={admin.createdAt} /></TableCell>
                </TableRow>
              ))}
            </tbody>
          </AdminTable>
        ) : <EmptyState title="No administrator memberships" description="No administrator memberships are currently recorded." />}
      </AdminPanel>
    </div>
  );
}
