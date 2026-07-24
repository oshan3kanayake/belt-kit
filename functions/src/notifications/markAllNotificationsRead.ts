import {
  FieldValue,
  getFirestore,
  type Query,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import {
  COLLECTIONS,
  FUNCTIONS_REGION,
} from "./notificationConfig";

interface MarkAllNotificationsReadRequest {
  branchId?: unknown;
}

const BATCH_LIMIT = 400;

/**
 * Marks all unread notifications belonging to the authenticated
 * user as read.
 *
 * When branchId is supplied, only notifications from that branch
 * are updated.
 */
export const markAllNotificationsRead = onCall(
  {
    region: FUNCTIONS_REGION,
  },
  async (request) => {
    const authenticatedUid =
      request.auth?.uid;

    if (!authenticatedUid) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to update notifications.",
      );
    }

    const requestData =
      request.data as
        MarkAllNotificationsReadRequest |
        undefined;

    const branchId = readOptionalString(
      requestData?.branchId,
      "branchId",
    );

    const db = getFirestore();

    let updatedCount = 0;

    while (true) {
      let unreadQuery: Query<DocumentData> = db
        .collection(COLLECTIONS.notifications)
        .where(
          "recipientUid",
          "==",
          authenticatedUid,
        )
        .where(
          "isRead",
          "==",
          false,
        );

      if (branchId) {
        unreadQuery = unreadQuery.where(
          "branchId",
          "==",
          branchId,
        );
      }

      const unreadSnapshot =
        await unreadQuery
          .limit(BATCH_LIMIT)
          .get();

      if (unreadSnapshot.empty) {
        break;
      }

      const batch = db.batch();

      for (
        const notificationDocument
        of unreadSnapshot.docs
      ) {
        batch.update(
          notificationDocument.ref,
          {
            isRead: true,
            readAt:
              FieldValue.serverTimestamp(),
          },
        );
      }

      await batch.commit();

      updatedCount += unreadSnapshot.size;

      if (
        unreadSnapshot.size <
        BATCH_LIMIT
      ) {
        break;
      }
    }

    return {
      success: true,
      updatedCount,
      branchId: branchId ?? null,
    };
  },
);

function readOptionalString(
  value: unknown,
  fieldName: string,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a string.`,
    );
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue;
}