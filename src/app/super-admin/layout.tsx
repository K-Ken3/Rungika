import { requireAdmin } from "@/lib/auth/authorization";
import { requireActiveAdminMembership } from "@/lib/data/admin";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  return (
    <AdminShell name={user.name} email={user.email} role={admin.role}>
      {children}
    </AdminShell>
  );
}
