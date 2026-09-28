"use client";

import { initialBusinessActionState } from "@/lib/actions/business-state";

import { useActionState } from "react";
import {
  markNotificationAction,
} from "@/actions/business";
import { ActionMessage, ActionSubmitButton } from "@/components/business/form-controls";

type Notification = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationList({
  businessId,
  notifications,
}: {
  businessId: string;
  notifications: Notification[];
}) {
  const [state, action, pending] = useActionState(
    markNotificationAction.bind(null, businessId), initialBusinessActionState);
  const unread = notifications.filter((notification) => !notification.readAt).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{unread} unread notification{unread === 1 ? "" : "s"}</p>
        {unread > 0 ? (
          <form action={action} aria-busy={pending}>
            <input type="hidden" name="notificationId" value="" />
            <ActionSubmitButton pending={pending} className="border border-emerald-200 bg-emerald-50 text-slate-900 hover:bg-emerald-100">
              Mark all read
            </ActionSubmitButton>
          </form>
        ) : null}
      </div>
      <ActionMessage state={state} />
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-100 p-6 text-sm text-slate-600">
            There are no notifications for this business.
          </p>
        ) : (
          notifications.map((notification) => (
            <NotificationRow key={notification.id} businessId={businessId} notification={notification} />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  businessId,
  notification,
}: {
  businessId: string;
  notification: Notification;
}) {
  const [state, action, pending] = useActionState(
    markNotificationAction.bind(null, businessId), initialBusinessActionState);
  return (
    <article className={`rounded-xl border p-4 ${notification.readAt ? "border-emerald-100 bg-emerald-50" : "border-emerald-600 bg-emerald-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-emerald-950">{notification.title}</h2>
          <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
          <p className="mt-2 text-xs text-slate-600">{new Date(notification.createdAt).toLocaleString()}</p>
        </div>
        {!notification.readAt ? (
          <form action={action} aria-busy={pending}>
            <input type="hidden" name="notificationId" value={notification.id} />
            <ActionSubmitButton pending={pending} className="border border-emerald-200 bg-emerald-50 text-slate-900 hover:bg-emerald-100">
              Mark read
            </ActionSubmitButton>
          </form>
        ) : null}
      </div>
      <ActionMessage state={state} />
    </article>
  );
}
