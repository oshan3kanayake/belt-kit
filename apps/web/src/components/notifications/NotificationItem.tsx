"use client";

import { CalendarClock, CalendarOff, Package } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/lib/types/notification";

const iconStyles = {
  LOW_STOCK: { icon: Package, className: "bg-orange-50 text-orange-600" },
  NEXT_SERVICE: { icon: CalendarClock, className: "bg-sky-50 text-sky-600" },
  EMPLOYEE_ON_LEAVE: { icon: CalendarOff, className: "bg-violet-50 text-violet-600" },
} as const;

export function NotificationItem({
  notification,
  onSelect,
}: {
  notification: Notification;
  onSelect: (notification: Notification) => void;
}) {
  const style = iconStyles[notification.type];
  const Icon = style.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={`relative flex w-full gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-burgundy-500 ${
        notification.isRead ? "bg-white" : "bg-burgundy-50/60"
      }`}
    >
      {!notification.isRead && (
        <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-burgundy-500" />
      )}
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.className}`}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm text-ink ${notification.isRead ? "font-medium" : "font-semibold"}`}>
          {notification.title}
        </span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-ink-soft">
          {notification.message || "Open to view details."}
        </span>
        <span className="mt-1 block text-[11px] text-ink-faint">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

export default NotificationItem;
