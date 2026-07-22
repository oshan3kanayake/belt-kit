"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { useAuth } from "../auth-context";
import { db } from "../firebase";
import type {
  Notification,
  NotificationTargetType,
  NotificationType,
} from "../types/notification";

const LIST_LIMIT = 25;
const TYPES = new Set<NotificationType>(["LOW_STOCK", "NEXT_SERVICE", "EMPLOYEE_ON_LEAVE"]);
const TARGET_TYPES = new Set<NotificationTargetType>(["PART", "VEHICLE", "JOB_CARD", "ATTENDANCE"]);

function readString(data: DocumentData, field: string) {
  return typeof data[field] === "string" ? data[field].trim() : "";
}

function parseNotification(document: QueryDocumentSnapshot<DocumentData>): Notification {
  const data = document.data();
  const type = readString(data, "type") as NotificationType;
  const targetType = readString(data, "targetType") as NotificationTargetType;
  const malformed = !TYPES.has(type) || !TARGET_TYPES.has(targetType) || !readString(data, "title");
  return {
    id: document.id,
    branchId: readString(data, "branchId"),
    recipientUid: readString(data, "recipientUid"),
    type: TYPES.has(type) ? type : "LOW_STOCK",
    title: readString(data, "title") || "Notification",
    message: readString(data, "message"),
    targetType: TARGET_TYPES.has(targetType) ? targetType : "PART",
    targetId: readString(data, "targetId"),
    sourceEventId: readString(data, "sourceEventId") || undefined,
    relatedPartId: readString(data, "relatedPartId") || undefined,
    relatedVehicleId: readString(data, "relatedVehicleId") || undefined,
    relatedJobCardId: readString(data, "relatedJobCardId") || undefined,
    relatedEmployeeId: readString(data, "relatedEmployeeId") || undefined,
    relatedAttendanceId: readString(data, "relatedAttendanceId") || undefined,
    attendanceDate: readString(data, "attendanceDate") || undefined,
    isRead: data.isRead === true,
    readAt: (data.readAt as Timestamp | null) ?? null,
    createdAt: (data.createdAt as Timestamp | null) ?? null,
    malformed,
  };
}

export function useNotifications() {
  const { user, branchId, roleResolved } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [listReady, setListReady] = useState(false);
  const [countReady, setCountReady] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const userId = user?.uid;

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setListError(null);
    setCountError(null);
    setListReady(false);
    setCountReady(false);

    if (!roleResolved || !userId || !branchId) {
      setListReady(true);
      setCountReady(true);
      return;
    }

    const baseFilters = [
      where("recipientUid", "==", userId),
      where("branchId", "==", branchId),
    ];
    const listQuery = query(
      collection(db, "notifications"),
      ...baseFilters,
      orderBy("createdAt", "desc"),
      limit(LIST_LIMIT),
    );
    const unreadQuery = query(
      collection(db, "notifications"),
      ...baseFilters,
      where("isRead", "==", false),
    );

    const errorMessage = (listenerError: { code?: string; message: string }) => {
      const message = listenerError.code === "permission-denied"
        ? "You do not have permission to read notifications."
        : listenerError.code === "failed-precondition"
          ? "Notifications require a Firestore index."
          : listenerError.message || "Could not load notifications.";
      return message;
    };

    const unsubscribeList = onSnapshot(
      listQuery,
      (snapshot) => {
        setNotifications(snapshot.docs.map(parseNotification));
        setListReady(true);
        setListError(null);
      },
      (listenerError) => {
        setListError(errorMessage(listenerError));
        setListReady(true);
      },
    );
    const unsubscribeUnread = onSnapshot(
      unreadQuery,
      (snapshot) => {
        setUnreadCount(snapshot.size);
        setCountReady(true);
        setCountError(null);
      },
      (listenerError) => {
        setCountError(errorMessage(listenerError));
        setCountReady(true);
      },
    );

    return () => {
      unsubscribeList();
      unsubscribeUnread();
    };
  }, [branchId, generation, roleResolved, userId]);

  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const loading = !listReady || !countReady;
  const error = listError || countError;

  return useMemo(
    () => ({ notifications, unreadCount, loading, error, retry }),
    [error, loading, notifications, retry, unreadCount],
  );
}

export default useNotifications;
