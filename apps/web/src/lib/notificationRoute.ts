import type { Notification } from "./types/notification";

export function getNotificationRoute(notification: Notification): string {
  if (notification.malformed) return "/dashboard";
  if (notification.type === "LOW_STOCK" || notification.targetType === "PART") {
    return "/dashboard/inventory";
  }

  if (notification.type === "NEXT_SERVICE") {
    const vehicleId = notification.relatedVehicleId ||
      (notification.targetType === "VEHICLE" ? notification.targetId : "");
    if (vehicleId) return `/dashboard/vehicles/${encodeURIComponent(vehicleId)}`;
    if (notification.relatedJobCardId) {
      return `/dashboard/job-cards/${encodeURIComponent(notification.relatedJobCardId)}`;
    }
    return "/dashboard/job-cards";
  }

  if (
    notification.type === "EMPLOYEE_ON_LEAVE" ||
    notification.targetType === "ATTENDANCE"
  ) {
    const params = new URLSearchParams();
    if (notification.attendanceDate) params.set("date", notification.attendanceDate);
    if (notification.relatedEmployeeId) params.set("employeeId", notification.relatedEmployeeId);
    const query = params.toString();
    return `/dashboard/employees/attendance${query ? `?${query}` : ""}`;
  }

  if (notification.targetType === "VEHICLE" && notification.targetId) {
    return `/dashboard/vehicles/${encodeURIComponent(notification.targetId)}`;
  }
  if (notification.targetType === "JOB_CARD" && notification.targetId) {
    return `/dashboard/job-cards/${encodeURIComponent(notification.targetId)}`;
  }
  return "/dashboard";
}
