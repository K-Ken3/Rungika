import { requireAdmin } from "@/lib/auth/authorization";
import { requireActiveAdminMembership } from "@/lib/data/admin";
import { getPlatformSettings } from "@/lib/data/platform-settings";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { AdminPageHeader, AdminPanel, DateText, Notice, PanelHeading } from "@/components/admin/ui";

export default async function PlatformSettingsPage() {
  const user = await requireAdmin();
  const admin = await requireActiveAdminMembership(user);
  const settings = await getPlatformSettings(admin);
  const editable = admin.role === "SUPER_ADMIN";

  return (
    <div>
      <AdminPageHeader eyebrow="Platform configuration" title="Platform settings" description="Control the default plan, billing policy, Mobile Money instructions, business limits, and notification channel switches. Updates are validated server-side and audited without exposing stored QR keys." />
      {!editable ? <Notice tone="info">You can review the current configuration. Only a super administrator can change platform-wide settings.</Notice> : null}
      <AdminPanel>
        <PanelHeading title="Configuration" description={`Last updated ${new Date(settings.updatedAt).toLocaleString("en")}`} />
        <div className="p-5 sm:p-6"><PlatformSettingsForm settings={settings} editable={editable} /></div>
      </AdminPanel>
      <AdminPanel className="mt-6">
        <PanelHeading title="Configuration notes" />
        <div className="space-y-3 p-5 text-sm leading-6 text-slate-600 sm:p-6">
          <p><strong className="text-slate-800">Currency safety:</strong> the configured payment currency must match the plan currency because the current schema has one price and no separate fixed local amount.</p>
          <p><strong className="text-slate-800">Secret handling:</strong> the Mobile Money QR storage key is write-only in this workspace. The browser receives only whether one is configured.</p>
          <p><strong className="text-slate-800">Notification language:</strong> channel switches describe application configuration; delivery outcomes are shown from actual delivery records.</p>
          <p className="text-xs text-slate-600">Updated <DateText value={settings.updatedAt} withTime /></p>
        </div>
      </AdminPanel>
    </div>
  );
}
