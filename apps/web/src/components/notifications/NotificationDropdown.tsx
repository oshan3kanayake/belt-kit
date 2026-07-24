"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { GearLoader, useToast } from "@/components/ui";
import { getNotificationRoute } from "@/lib/notificationRoute";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/services/notificationService";
import type { Notification } from "@/lib/types/notification";
import { NotificationItem } from "./NotificationItem";

type Props = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  branchId: string | null;
  retry: () => void;
  onClose: () => void;
};

export function NotificationDropdown(props: Props) {
  const { notifications, unreadCount, loading, error, branchId, retry, onClose } = props;
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  const selectNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not mark notification as read.", "error");
      }
    }
    onClose();
    router.push(getNotificationRoute(notification));
  };

  const markAll = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(branchId || undefined);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not mark notifications as read.", "error");
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <section
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(34rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-luxe-lg"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          <p className="text-[11px] text-ink-faint">{unreadCount} unread</p>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={!unreadCount || markingAll}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-burgundy-600 transition hover:bg-burgundy-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck size={14} />
          {markingAll ? "Marking…" : "Mark all as read"}
        </button>
      </header>

      <div className="min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-xs text-ink-faint">
            <GearLoader size={32} />
            Loading notifications…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">Could not load notifications</p>
            <p className="mt-1 text-xs text-ink-soft">{error}</p>
            <button type="button" onClick={retry} className="btn-ghost mt-4 text-xs">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-burgundy-50 text-burgundy-600">
              <Bell size={20} />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">No notifications yet</p>
            <p className="mt-1 text-xs text-ink-faint">New garage alerts will appear here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onSelect={selectNotification} />
          ))
        )}
      </div>
    </section>
  );
}

export default NotificationDropdown;
