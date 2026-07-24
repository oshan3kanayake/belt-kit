/**
 * Shared configuration for Belt-Kit in-app notifications.
 */

export const FUNCTIONS_REGION = "us-central1";

export const NOTIFICATION_TIME_ZONE = "Asia/Colombo";

export const COLLECTIONS = {
  users: "users",
  parts: "parts",
  jobCards: "jobCards",
  attendance: "attendance",
  notifications: "notifications",
  serviceReminders: "serviceReminders",
} as const;

/**
 * Users with these roles receive general branch notifications,
 * such as low-stock and next-service alerts.
 *
 * Belt-Kit's current role model uses "advisor" for front-desk staff.
 *
 * The additional aliases are retained for compatibility with
 * existing emulator data or older user documents.
 */
export const NOTIFICATION_RECIPIENT_ROLES = [
  "owner",
  "admin",
  "manager",
  "advisor",
  "frontdesk",
  "front_desk",
  "front desk",
] as const;


/**
 * Roles that receive employee-on-leave notifications.
 *
 * Owners and managers need visibility of staff availability.
 * "advisor" represents front-desk staff in Belt-Kit.
 */
export const FRONT_DESK_NOTIFICATION_ROLES = [
  "owner",
  "manager",
  "advisor",

  // Compatibility roles used by older/local profiles.
  "admin",
  "frontdesk",
  "front_desk",
  "front desk",
] as const;

/**
 * Attendance statuses considered on leave.
 *
 * Status values are normalized to lowercase before comparison,
 * so "ON_LEAVE" will match "on_leave".
 */
export const ON_LEAVE_ATTENDANCE_STATUSES = [
  "on_leave",
  "on-leave",
  "on leave",
  "leave",
] as const;

/**
 * Create the next-service alert this many days before
 * the next service date.
 */
export const SERVICE_REMINDER_DAYS_BEFORE = 7;

/**
 * Supported inventory quantity fields.
 *
 * Belt-Kit's current Part interface uses quantityOnHand.
 * The other fields are retained for backward compatibility.
 */
export const STOCK_QUANTITY_FIELDS = [
  "quantityOnHand",
  "quantity",
  "stockQuantity",
  "currentStock",
  "qty",
] as const;

/**
 * Supported low-stock threshold fields.
 *
 * Belt-Kit's current Part interface uses reorderThreshold.
 */
export const STOCK_THRESHOLD_FIELDS = [
  "reorderThreshold",
  "reorderLevel",
  "lowStockLevel",
  "minimumStock",
  "minimumQuantity",
] as const;

/**
 * Job-card statuses considered finished.
 *
 * Belt-Kit's current JobStatus uses "delivered" as its final status.
 */
export const COMPLETED_JOB_STATUSES = [
  "delivered",
  "completed",
  "complete",
  "finished",
] as const;

/**
 * Supported next-service date fields.
 */
export const NEXT_SERVICE_DATE_FIELDS = [
  "nextServiceDate",
  "nextServiceDueDate",
  "serviceDueDate",
] as const;