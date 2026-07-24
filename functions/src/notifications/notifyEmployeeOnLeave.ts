import {
  logger,
} from "firebase-functions";

import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

import {
  getFirestore,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  COLLECTIONS,
  FRONT_DESK_NOTIFICATION_ROLES,
  FUNCTIONS_REGION,
  ON_LEAVE_ATTENDANCE_STATUSES,
} from "./notificationConfig";

import {
  createBranchNotifications,
} from "./createBranchNotifications";

/**
 * Creates an in-app notification for front-desk users when an
 * employee is marked as on leave.
 *
 * A notification is created when:
 *
 * 1. A new attendance document is created with status ON_LEAVE, or
 * 2. An existing attendance document changes from another status
 *    to ON_LEAVE.
 *
 * Updates to an attendance record that is already ON_LEAVE do not
 * create duplicate notifications.
 */
export const notifyEmployeeOnLeave =
  onDocumentWritten(
    {
      document:
        `${COLLECTIONS.attendance}/{attendanceId}`,

      region: FUNCTIONS_REGION,
    },
    async (event) => {
      const change = event.data;

      if (!change) {
        return;
      }

      const beforeSnapshot =
        change.before;

      const afterSnapshot =
        change.after;

      /**
       * Ignore deleted attendance documents.
       */
      if (!afterSnapshot.exists) {
        return;
      }

      const afterData =
        afterSnapshot.data();

      if (!afterData) {
        return;
      }

      const attendanceId =
        String(
          event.params.attendanceId,
        );

      const afterStatus =
        readString(
          afterData,
          ["status"],
        );

      /**
       * Only continue when the new status is on leave.
       */
      if (
        !isOnLeaveStatus(afterStatus)
      ) {
        return;
      }

      const beforeData =
        beforeSnapshot.exists
          ? beforeSnapshot.data()
          : undefined;

      const beforeStatus =
        readString(
          beforeData,
          ["status"],
        );

      /**
       * The employee was already on leave before this update.
       * Do not create another notification.
       */
      if (
        isOnLeaveStatus(beforeStatus)
      ) {
        return;
      }

      const branchId =
        readString(
          afterData,
          ["branchId"],
        );

      const employeeId =
        readString(
          afterData,
          ["employeeId"],
        );

      const attendanceDate =
        readString(
          afterData,
          [
            "date",
            "attendanceDate",
          ],
        );

      if (!branchId || !employeeId) {
        logger.warn(
          "Employee leave notification skipped because required attendance fields are missing.",
          {
            attendanceId,
            branchId,
            employeeId,
            eventId: event.id,
          },
        );

        return;
      }

      const employeeName =
        await findEmployeeName(
          employeeId,
          branchId,
        );

      const notificationCount =
        await createBranchNotifications({
          branchId,

          type:
            "EMPLOYEE_ON_LEAVE",

          title:
            "Employee on leave",

          message:
            buildLeaveMessage(
              employeeName,
              attendanceDate,
            ),

          targetType:
            "ATTENDANCE",

          targetId:
            attendanceId,

          relatedAttendanceId:
            attendanceId,

          relatedEmployeeId:
            employeeId,

          attendanceDate:
            attendanceDate ??
            undefined,

        /**
         * Owners, managers, and front-desk/advisor users
         * in this branch receive this alert.
         */
          allowedRoles:
            FRONT_DESK_NOTIFICATION_ROLES,

          /**
           * Firebase keeps the same event ID when retrying
           * one event, preventing retry duplicates.
           *
           * A later change away from ON_LEAVE and back to
           * ON_LEAVE produces a new event and therefore a
           * new valid notification.
           */
          sourceEventId:
            `employee-on-leave:` +
            `${attendanceId}:` +
            `${event.id}`,
        });

      logger.info(
        "Employee-on-leave notifications created.",
        {
          attendanceId,
          branchId,
          employeeId,
          employeeName,
          attendanceDate,
          notificationCount,
          eventId: event.id,
        },
      );
    },
  );

function buildLeaveMessage(
  employeeName: string,
  attendanceDate: string | null,
): string {
  if (attendanceDate) {
    return (
      `${employeeName} is marked as ` +
      `on leave for ${attendanceDate}.`
    );
  }

  return (
    `${employeeName} has been marked ` +
    "as on leave."
  );
}

function isOnLeaveStatus(
  status: string | null,
): boolean {
  if (!status) {
    return false;
  }

  const normalizedStatus =
    status
      .trim()
      .toLowerCase();

  return (
    ON_LEAVE_ATTENDANCE_STATUSES
      .includes(
        normalizedStatus as
          typeof ON_LEAVE_ATTENDANCE_STATUSES[number],
      )
  );
}

/**
 * Attendance records store employeeId as the employee's
 * Firebase Authentication UID.
 *
 * The primary lookup therefore uses users/{employeeId}.
 * A uid-field query is used as a fallback for older data.
 */
async function findEmployeeName(
  employeeId: string,
  branchId: string,
): Promise<string> {
  const db = getFirestore();

  const directEmployeeSnapshot =
    await db
      .collection(COLLECTIONS.users)
      .doc(employeeId)
      .get();

  if (
    directEmployeeSnapshot.exists
  ) {
    const directEmployeeData =
      directEmployeeSnapshot.data();

    if (
      directEmployeeData &&
      belongsToBranch(
        directEmployeeData,
        branchId,
      )
    ) {
      return (
        readEmployeeName(
          directEmployeeData,
        ) ??
        "An employee"
      );
    }
  }

  /**
   * Compatibility fallback for a user collection where the
   * Auth UID is stored in a uid field instead of being used
   * as the Firestore document ID.
   */
  const fallbackSnapshot =
    await db
      .collection(COLLECTIONS.users)
      .where(
        "uid",
        "==",
        employeeId,
      )
      .limit(1)
      .get();

  if (fallbackSnapshot.empty) {
    return "An employee";
  }

  const fallbackData =
    fallbackSnapshot.docs[0].data();

  if (
    !belongsToBranch(
      fallbackData,
      branchId,
    )
  ) {
    return "An employee";
  }

  return (
    readEmployeeName(
      fallbackData,
    ) ??
    "An employee"
  );
}

function belongsToBranch(
  userData: DocumentData,
  branchId: string,
): boolean {
  if (
    userData.branchId === branchId
  ) {
    return true;
  }

  if (
    Array.isArray(
      userData.branchIds,
    )
  ) {
    return userData.branchIds
      .some(
        (value: unknown) =>
          value === branchId,
      );
  }

  return false;
}

function readEmployeeName(
  employeeData: DocumentData,
): string | null {
  return readString(
    employeeData,
    [
      "displayName",
      "name",
      "fullName",
      "employeeName",
    ],
  );
}

function readString(
  data:
    | DocumentData
    | undefined,
  fields: readonly string[],
): string | null {
  if (!data) {
    return null;
  }

  for (const field of fields) {
    const value = data[field];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  return null;
}