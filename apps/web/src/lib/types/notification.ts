import type { Timestamp } from "firebase/firestore";

export type NotificationType = "LOW_STOCK" | "NEXT_SERVICE" | "EMPLOYEE_ON_LEAVE";
export type NotificationTargetType = "PART" | "VEHICLE" | "JOB_CARD" | "ATTENDANCE";

export type Notification = {
  id: string;
  branchId: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetId: string;
  sourceEventId?: string;
  relatedPartId?: string;
  relatedVehicleId?: string;
  relatedJobCardId?: string;
  relatedEmployeeId?: string;
  relatedAttendanceId?: string;
  attendanceDate?: string;
  isRead: boolean;
  readAt: Timestamp | null;
  createdAt: Timestamp | null;
  malformed?: boolean;
};
