import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  COLLECTIONS,
  FUNCTIONS_REGION,
} from "./notificationConfig";

interface MarkNotificationReadRequest {
  notificationId?: unknown;
}

/**
 * Marks one notification as read.
 *
 * The authenticated user can only mark their own notification.
 */
export const markNotificationRead = onCall(
  {
    region: FUNCTIONS_REGION,
  },
  async (request) => {
    const authenticatedUid =
      request.auth?.uid;

    if (!authenticatedUid) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to update a notification.",
      );
    }

    const requestData =
      request.data as
        MarkNotificationReadRequest |
        undefined;

    const notificationId =
      readRequiredString(
        requestData?.notificationId,
        "notificationId",
      );

    const db = getFirestore();

    const notificationReference = db
      .collection(COLLECTIONS.notifications)
      .doc(notificationId);

    await db.runTransaction(
      async (transaction) => {
        const notificationSnapshot =
          await transaction.get(
            notificationReference,
          );

        if (
          !notificationSnapshot.exists
        ) {
          throw new HttpsError(
            "not-found",
            "Notification not found.",
          );
        }

        const notificationData =
          notificationSnapshot.data();

        if (
          notificationData?.recipientUid !==
          authenticatedUid
        ) {
          throw new HttpsError(
            "permission-denied",
            "You cannot update another user's notification.",
          );
        }

        if (
          notificationData.isRead === true
        ) {
          return;
        }

        transaction.update(
          notificationReference,
          {
            isRead: true,
            readAt:
              FieldValue.serverTimestamp(),
          },
        );
      },
    );

    return {
      success: true,
      notificationId,
    };
  },
);

function readRequiredString(
  value: unknown,
  fieldName: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} is required.`,
    );
  }

  return value.trim();
}