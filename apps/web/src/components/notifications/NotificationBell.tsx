"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, branchId } = useAuth();
  const state = useNotifications();

  useEffect(() => setOpen(false), [user?.uid, branchId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const badge = state.unreadCount > 99 ? "99+" : String(state.unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={state.unreadCount ? `Notifications, ${state.unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink-soft shadow-soft transition hover:border-burgundy-200 hover:text-burgundy-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500"
      >
        <Bell size={18} />
        {state.unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full border-2 border-white bg-rose-500 px-1 text-center text-[9px] font-bold leading-[14px] text-white">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationDropdown
          {...state}
          branchId={branchId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default NotificationBell;
