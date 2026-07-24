import {
  createHash,
} from "node:crypto";

import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import {
  COLLECTIONS,
  NOTIFICATION_RECIPIENT_ROLES,
} from "./notificationConfig";

import type {
  CreateBranchNotificationInput,
} from "../types";

const TRANSACTION_CHUNK_SIZE = 20;

/**
 * Creates one notification document for every eligible user
 * belonging to the supplied branch.
 *
 * Notification IDs are deterministic. If Firebase retries the same
 * event, existing notification documents will not be duplicated or
 * reset to unread.
 */
export async function createBranchNotifications(
  input: CreateBranchNotificationInput,
): Promise<number> {
  validateInput(input);

  const db = getFirestore();

  const allowedRoles = new Set(
    (
      input.allowedRoles ??
      NOTIFICATION_RECIPIENT_ROLES
    ).map((role) => normalizeRole(role)),
  );

  const recipientUids =
    await findRecipientUids(
      input.branchId,
      allowedRoles,
    );

  if (recipientUids.length === 0) {
    return 0;
  }

  let createdCount = 0;

  for (
    let startIndex = 0;
    startIndex < recipientUids.length;
    startIndex += TRANSACTION_CHUNK_SIZE
  ) {
    const recipientChunk =
      recipientUids.slice(
        startIndex,
        startIndex +
          TRANSACTION_CHUNK_SIZE,
      );

    const results = await Promise.all(
      recipientChunk.map(
        async (recipientUid) => {
          const notificationId =
            buildNotificationId(
              input.sourceEventId,
              recipientUid,
            );

          const notificationReference =
            db
              .collection(
                COLLECTIONS.notifications,
              )
              .doc(notificationId);

          return db.runTransaction(
            async (transaction) => {
              const existingNotification =
                await transaction.get(
                  notificationReference,
                );

              if (
                existingNotification.exists
              ) {
                return false;
              }

              transaction.create(
                notificationReference,
                buildNotificationDocument(
                  input,
                  recipientUid,
                ),
              );

              return true;
            },
          );
        },
      ),
    );

    createdCount +=
      results.filter(Boolean).length;
  }

  return createdCount;
}

async function findRecipientUids(
  branchId: string,
  allowedRoles: Set<string>,
): Promise<string[]> {
  const db = getFirestore();

  const usersCollection =
    db.collection(COLLECTIONS.users);

  /**
   * Belt-Kit currently uses branchId.
   *
   * branchIds is also supported for any future user who belongs
   * to more than one branch.
   */
  const [
    singleBranchSnapshot,
    multipleBranchSnapshot,
  ] = await Promise.all([
    usersCollection
      .where("branchId", "==", branchId)
      .get(),

    usersCollection
      .where(
        "branchIds",
        "array-contains",
        branchId,
      )
      .get(),
  ]);

  const documents = new Map<
    string,
    QueryDocumentSnapshot<DocumentData>
  >();

  for (
    const document
    of singleBranchSnapshot.docs
  ) {
    documents.set(
      document.id,
      document,
    );
  }

  for (
    const document
    of multipleBranchSnapshot.docs
  ) {
    documents.set(
      document.id,
      document,
    );
  }

  const recipientUids =
    new Set<string>();

  for (
    const document
    of documents.values()
  ) {
    const userData = document.data();

    if (
      !isEligibleRecipient(
        userData,
        allowedRoles,
      )
    ) {
      continue;
    }

    /**
     * User-profile documents should normally use the Firebase
     * Auth UID as their document ID.
     *
     * The uid field is retained as an optional fallback.
     */
    const recipientUid =
      readNonEmptyString(userData.uid) ??
      document.id;

    recipientUids.add(recipientUid);
  }

  return [...recipientUids];
}

function buildNotificationDocument(
  input: CreateBranchNotificationInput,
  recipientUid: string,
): DocumentData {
  const notification: DocumentData = {
    branchId: input.branchId,
    recipientUid,

    type: input.type,

    title: input.title,
    message: input.message,

    targetType: input.targetType,
    targetId: input.targetId,

    sourceEventId: input.sourceEventId,

    isRead: false,
    readAt: null,

    createdAt:
      FieldValue.serverTimestamp(),
  };

  if (input.relatedPartId) {
    notification.relatedPartId =
      input.relatedPartId;
  }

  if (input.relatedVehicleId) {
    notification.relatedVehicleId =
      input.relatedVehicleId;
  }

  if (input.relatedJobCardId) {
    notification.relatedJobCardId =
      input.relatedJobCardId;
  }

  if (input.relatedEmployeeId) {
    notification.relatedEmployeeId =
      input.relatedEmployeeId;
  }

  if (input.relatedAttendanceId) {
    notification.relatedAttendanceId =
      input.relatedAttendanceId;
  }

  if (input.attendanceDate) {
    notification.attendanceDate =
      input.attendanceDate;
  }

  return notification;
}

function isEligibleRecipient(
  userData: DocumentData,
  allowedRoles: Set<string>,
): boolean {
  /**
   * Belt-Kit's UserProfile currently uses active.
   *
   * Other common active/disabled field names are also supported
   * for compatibility with existing data.
   */
  if (
    userData.disabled === true ||
    userData.isDisabled === true ||
    userData.active === false ||
    userData.isActive === false
  ) {
    return false;
  }

  const userRoles: string[] = [];

  if (typeof userData.role === "string") {
    userRoles.push(
      normalizeRole(userData.role),
    );
  }

  if (Array.isArray(userData.roles)) {
    for (const role of userData.roles) {
      if (typeof role === "string") {
        userRoles.push(
          normalizeRole(role),
        );
      }
    }
  }

  return userRoles.some((role) =>
    allowedRoles.has(role),
  );
}

function buildNotificationId(
  sourceEventId: string,
  recipientUid: string,
): string {
  return createHash("sha256")
    .update(
      `${sourceEventId}:${recipientUid}`,
    )
    .digest("hex")
    .slice(0, 48);
}

function normalizeRole(
  role: string,
): string {
  return role.trim().toLowerCase();
}

function readNonEmptyString(
  value: unknown,
): string | null {
  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value.trim();
  }

  return null;
}

function validateInput(
  input: CreateBranchNotificationInput,
): void {
  const requiredValues = [
    input.branchId,
    input.type,
    input.title,
    input.message,
    input.targetType,
    input.targetId,
    input.sourceEventId,
  ];

  const hasInvalidValue =
    requiredValues.some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0,
    );

  if (hasInvalidValue) {
    throw new Error(
      "Cannot create notification because required fields are missing.",
    );
  }
}