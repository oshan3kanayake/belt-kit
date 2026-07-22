import { logger } from "firebase-functions";

import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  COLLECTIONS,
  COMPLETED_JOB_STATUSES,
  FUNCTIONS_REGION,
  NEXT_SERVICE_DATE_FIELDS,
  NOTIFICATION_TIME_ZONE,
  SERVICE_REMINDER_DAYS_BEFORE,
} from "./notificationConfig";

import {
  createBranchNotifications,
} from "./createBranchNotifications";

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

/**
 * Creates or updates a service reminder when:
 *
 * 1. A job card changes to completed, or
 * 2. nextServiceDate is added/changed on an already completed job card.
 */
export const createServiceReminder = onDocumentWritten(
  {
    document: `${COLLECTIONS.jobCards}/{jobCardId}`,
    region: FUNCTIONS_REGION,
  },
  async (event) => {
    const change = event.data;

    if (!change) {
      return;
    }

    const beforeSnapshot = change.before;
    const afterSnapshot = change.after;

    /**
     * Ignore deleted job cards.
     */
    if (!afterSnapshot.exists) {
      return;
    }

    const afterData = afterSnapshot.data();

    if (!afterData) {
      return;
    }

    const beforeData = beforeSnapshot.exists
      ? beforeSnapshot.data()
      : undefined;

    const jobCardId = event.params.jobCardId;

    const beforeStatus = readString(
      beforeData,
      ["status"],
    );

    const afterStatus = readString(
      afterData,
      ["status"],
    );

    const wasCompleted =
      isCompletedStatus(beforeStatus);

    const isCompleted =
      isCompletedStatus(afterStatus);

    if (!isCompleted) {
      return;
    }

    const beforeNextServiceDate = readTimestamp(
      beforeData,
      NEXT_SERVICE_DATE_FIELDS,
    );

    const nextServiceDate = readTimestamp(
      afterData,
      NEXT_SERVICE_DATE_FIELDS,
    );

    const becameCompleted =
      !wasCompleted && isCompleted;

    const nextServiceDateChanged =
      timestampsAreDifferent(
        beforeNextServiceDate,
        nextServiceDate,
      );

    /**
     * Ignore unrelated edits to an already-completed job card.
     */
    if (
      !becameCompleted &&
      !nextServiceDateChanged
    ) {
      return;
    }

    if (!nextServiceDate) {
      logger.warn(
        "Service reminder skipped because the completed job card has no nextServiceDate.",
        {
          jobCardId,
          eventId: event.id,
        },
      );

      return;
    }

    const branchId = readString(afterData, [
      "branchId",
    ]);

    if (!branchId) {
      logger.warn(
        "Service reminder skipped because the job card has no branchId.",
        {
          jobCardId,
          eventId: event.id,
        },
      );

      return;
    }

    const vehicleId = readString(afterData, [
      "vehicleId",
    ]);

    if (!vehicleId) {
      logger.warn(
        "Service reminder skipped because the job card has no vehicleId.",
        {
          branchId,
          jobCardId,
          eventId: event.id,
        },
      );

      return;
    }

    const customerId = readString(afterData, [
      "customerId",
    ]);

    const vehicleRegistration = readString(
      afterData,
      [
        "vehicleRegistration",
        "registrationNumber",
        "vehicleNumber",
        "registration",
      ],
    );

    const currentTimestamp = Timestamp.now();

    const calculatedNotifyAtMilliseconds =
      nextServiceDate.toMillis() -
      (
        SERVICE_REMINDER_DAYS_BEFORE *
        MILLISECONDS_PER_DAY
      );

    const notifyAt = Timestamp.fromMillis(
      Math.max(
        calculatedNotifyAtMilliseconds,
        currentTimestamp.toMillis(),
      ),
    );

    const db = getFirestore();

    const reminderReference = db
      .collection(COLLECTIONS.serviceReminders)
      .doc(jobCardId);

    await db.runTransaction(async (transaction) => {
      const existingReminder =
        await transaction.get(reminderReference);

      const reminderData: DocumentData = {
        branchId,
        jobCardId,
        vehicleId,

        nextServiceDate,
        notifyAt,

        notifiedAt: null,
        notificationCount: 0,

        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!existingReminder.exists) {
        reminderData.createdAt =
          FieldValue.serverTimestamp();
      }

      if (customerId) {
        reminderData.customerId = customerId;
      }

      if (vehicleRegistration) {
        reminderData.vehicleRegistration =
          vehicleRegistration;
      }

      transaction.set(
        reminderReference,
        reminderData,
        {
          merge: true,
        },
      );
    });

    /**
     * If the reminder date is today or already overdue,
     * create the notification immediately.
     */
    if (
      notifyAt.toMillis() <=
      currentTimestamp.toMillis()
    ) {
      const notificationCount =
        await createBranchNotifications({
          branchId,

          type: "NEXT_SERVICE",

          title: "Upcoming vehicle service",

          message: buildServiceMessage(
            vehicleRegistration,
            nextServiceDate,
          ),

          targetType: "VEHICLE",
          targetId: vehicleId,

          relatedVehicleId: vehicleId,
          relatedJobCardId: jobCardId,

          sourceEventId:
            `service-reminder:${jobCardId}:` +
            `${nextServiceDate.toMillis()}`,
        });

      await reminderReference.update({
        notifiedAt:
          FieldValue.serverTimestamp(),

        notificationCount,

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      logger.info(
        "Immediate service reminder notifications created.",
        {
          branchId,
          jobCardId,
          vehicleId,
          notificationCount,
          eventId: event.id,
        },
      );

      return;
    }

    logger.info(
      "Future service reminder created.",
      {
        branchId,
        jobCardId,
        vehicleId,
        nextServiceDate:
          nextServiceDate.toDate().toISOString(),
        notifyAt:
          notifyAt.toDate().toISOString(),
        eventId: event.id,
      },
    );
  },
);

function isCompletedStatus(
  status: string | null,
): boolean {
  if (!status) {
    return false;
  }

  const normalizedStatus =
    status.trim().toLowerCase();

  return COMPLETED_JOB_STATUSES.includes(
    normalizedStatus as
      typeof COMPLETED_JOB_STATUSES[number],
  );
}

function buildServiceMessage(
  vehicleRegistration: string | null,
  nextServiceDate: Timestamp,
): string {
  const formattedDate =
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: NOTIFICATION_TIME_ZONE,
    }).format(nextServiceDate.toDate());

  if (vehicleRegistration) {
    return (
      `Vehicle ${vehicleRegistration} is due ` +
      `for its next service on ${formattedDate}.`
    );
  }

  return (
    `A vehicle is due for its next service ` +
    `on ${formattedDate}.`
  );
}

function timestampsAreDifferent(
  first: Timestamp | null,
  second: Timestamp | null,
): boolean {
  if (!first && !second) {
    return false;
  }

  if (!first || !second) {
    return true;
  }

  return (
    first.toMillis() !== second.toMillis()
  );
}

function readString(
  data: DocumentData | undefined,
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

function readTimestamp(
  data: DocumentData | undefined,
  fields: readonly string[],
): Timestamp | null {
  if (!data) {
    return null;
  }

  for (const field of fields) {
    const value = data[field];

    const parsedTimestamp =
      parseTimestamp(value);

    if (parsedTimestamp) {
      return parsedTimestamp;
    }
  }

  return null;
}

function parseTimestamp(
  value: unknown,
): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return Timestamp.fromDate(value);
    }

    return null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    const date = (
      value as {
        toDate: () => Date;
      }
    ).toDate();

    if (
      date instanceof Date &&
      !Number.isNaN(date.getTime())
    ) {
      return Timestamp.fromDate(date);
    }
  }

  if (typeof value === "string") {
    const milliseconds = Date.parse(value);

    if (!Number.isNaN(milliseconds)) {
      return Timestamp.fromMillis(milliseconds);
    }
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    /**
     * Values below 10 trillion are treated as Unix seconds.
     * Larger values are treated as milliseconds.
     */
    const milliseconds =
      value < 10_000_000_000
        ? value * 1000
        : value;

    return Timestamp.fromMillis(milliseconds);
  }

  return null;
}