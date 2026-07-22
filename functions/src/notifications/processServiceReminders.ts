import { logger } from "firebase-functions";

import {
  onSchedule,
} from "firebase-functions/v2/scheduler";

import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import {
  COLLECTIONS,
  FUNCTIONS_REGION,
  NOTIFICATION_TIME_ZONE,
} from "./notificationConfig";

import {
  createBranchNotifications,
} from "./createBranchNotifications";

const QUERY_LIMIT = 100;
const PROCESSING_CHUNK_SIZE = 10;

/**
 * Runs every day at 8:00 AM in Sri Lanka time.
 *
 * Finds service reminders whose notifyAt time has arrived
 * and creates in-app notifications for eligible branch users.
 */
export const processServiceReminders = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: NOTIFICATION_TIME_ZONE,
    region: FUNCTIONS_REGION,
  },
  async () => {
    await processDueServiceReminders();
  },
);

/**
 * Processes all currently-due reminders.
 *
 * Exported so emulator integration tests can exercise the scheduler's real
 * implementation without adding a deployable HTTP-only test function.
 */
export async function processDueServiceReminders(): Promise<{
  processedCount: number;
  notificationCount: number;
}> {
    const db = getFirestore();

    let processedCount = 0;
    let notificationCount = 0;

    while (true) {
      const now = Timestamp.now();

      const reminderSnapshot = await db
        .collection(COLLECTIONS.serviceReminders)
        .where("notifiedAt", "==", null)
        .where("notifyAt", "<=", now)
        .orderBy("notifyAt", "asc")
        .limit(QUERY_LIMIT)
        .get();

      if (reminderSnapshot.empty) {
        break;
      }

      for (
        let startIndex = 0;
        startIndex < reminderSnapshot.docs.length;
        startIndex += PROCESSING_CHUNK_SIZE
      ) {
        const documentChunk = reminderSnapshot.docs.slice(
          startIndex,
          startIndex + PROCESSING_CHUNK_SIZE,
        );

        const results = await Promise.all(
          documentChunk.map((reminderDocument) =>
            processReminder(reminderDocument),
          ),
        );

        processedCount += results.length;

        notificationCount += results.reduce(
          (total, result) => total + result,
          0,
        );
      }

      if (reminderSnapshot.size < QUERY_LIMIT) {
        break;
      }
    }

    logger.info(
      "Service-reminder processing finished.",
      {
        processedCount,
        notificationCount,
      },
    );

    return { processedCount, notificationCount };
}

async function processReminder(
  reminderDocument: QueryDocumentSnapshot<DocumentData>,
): Promise<number> {
  const reminderData = reminderDocument.data();

  const branchId = readString(
    reminderData,
    ["branchId"],
  );

  const jobCardId =
    readString(
      reminderData,
      ["jobCardId"],
    ) ?? reminderDocument.id;

  const vehicleId = readString(
    reminderData,
    ["vehicleId"],
  );

  const vehicleRegistration = readString(
    reminderData,
    [
      "vehicleRegistration",
      "registrationNumber",
      "vehicleNumber",
      "registration",
    ],
  );

  const nextServiceDate = readTimestamp(
    reminderData,
    ["nextServiceDate"],
  );

  if (
    !branchId ||
    !jobCardId ||
    !vehicleId ||
    !nextServiceDate
  ) {
    logger.error(
      "Invalid service reminder document.",
      {
        reminderId: reminderDocument.id,
        branchId,
        jobCardId,
        vehicleId,
      },
    );

    await reminderDocument.ref.update({
      notifiedAt: FieldValue.serverTimestamp(),
      processingError: "Invalid service reminder data.",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return 0;
  }

  const createdNotificationCount =
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

  await reminderDocument.ref.update({
    notifiedAt: FieldValue.serverTimestamp(),

    notificationCount: createdNotificationCount,

    processingError: FieldValue.delete(),

    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(
    "Service reminder processed.",
    {
      reminderId: reminderDocument.id,
      branchId,
      jobCardId,
      vehicleId,
      createdNotificationCount,
    },
  );

  return createdNotificationCount;
}

function buildServiceMessage(
  vehicleRegistration: string | null,
  nextServiceDate: Timestamp,
): string {
  const formattedDate = new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeZone: NOTIFICATION_TIME_ZONE,
    },
  ).format(nextServiceDate.toDate());

  if (vehicleRegistration) {
    return (
      `Vehicle ${vehicleRegistration} is due ` +
      `for its next service on ${formattedDate}.`
    );
  }

  return (
    "A vehicle is due for its next service " +
    `on ${formattedDate}.`
  );
}

function readString(
  data: DocumentData,
  fields: readonly string[],
): string | null {
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
  data: DocumentData,
  fields: readonly string[],
): Timestamp | null {
  for (const field of fields) {
    const value = data[field];

    if (value instanceof Timestamp) {
      return value;
    }

    if (
      value instanceof Date &&
      !Number.isNaN(value.getTime())
    ) {
      return Timestamp.fromDate(value);
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
      const milliseconds =
        value < 10_000_000_000
          ? value * 1000
          : value;

      return Timestamp.fromMillis(milliseconds);
    }
  }

  return null;
}
