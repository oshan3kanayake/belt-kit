"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!notificationId.trim()) throw new Error("Notification ID is required.");
  const callable = httpsCallable<{ notificationId: string }, { success: boolean }>(
    functions,
    "markNotificationRead",
  );
  await callable({ notificationId });
}

export async function markAllNotificationsRead(branchId?: string): Promise<number> {
  const callable = httpsCallable<
    { branchId?: string },
    { success: boolean; updatedCount: number }
  >(functions, "markAllNotificationsRead");
  const result = await callable(branchId ? { branchId } : {});
  return result.data.updatedCount ?? 0;
}

export default { markNotificationRead, markAllNotificationsRead };
