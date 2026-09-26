import { NotificationList } from "@/components/business/notification-list";
import { requireUser } from "@/lib/auth/authorization";
import { getBusinessNotifications } from "@/lib/data/business";

export default async function NotificationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const user = await requireUser(`/business/${encodeURIComponent(businessId)}/notifications`);
  const notifications = await getBusinessNotifications(user.id, businessId);
  return <div className="space-y-8"><header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Inbox</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Notifications</h1><p className="mt-2 text-slate-600">In-app billing, payment, system, and account messages for this business.</p></header><NotificationList businessId={businessId} notifications={notifications} /></div>;
}
