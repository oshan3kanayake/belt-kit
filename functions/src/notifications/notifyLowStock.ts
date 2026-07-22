import { logger } from "firebase-functions";

import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";

import type {
  DocumentData,
} from "firebase-admin/firestore";

import {
  COLLECTIONS,
  FUNCTIONS_REGION,
  STOCK_QUANTITY_FIELDS,
  STOCK_THRESHOLD_FIELDS,
} from "./notificationConfig";

import {
  createBranchNotifications,
} from "./createBranchNotifications";

/**
 * Creates a LOW_STOCK notification when a part crosses from:
 *
 * quantity > reorderLevel
 *
 * to:
 *
 * quantity <= reorderLevel
 *
 * It does not repeatedly create notifications while the part
 * remains below the reorder level.
 */
export const notifyLowStock = onDocumentWritten(
  {
    document: `${COLLECTIONS.parts}/{partId}`,
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
     * Ignore part deletion.
     */
    if (!afterSnapshot.exists) {
      return;
    }

    const afterData = afterSnapshot.data();

    if (!afterData) {
      return;
    }

    const partId = event.params.partId;

    const branchId = readString(afterData, [
      "branchId",
    ]);

    if (!branchId) {
      logger.warn(
        "Low-stock notification skipped because the part has no branchId.",
        {
          partId,
          eventId: event.id,
        },
      );

      return;
    }

    const afterQuantity = readNumber(
      afterData,
      STOCK_QUANTITY_FIELDS,
    );

    const afterThreshold = readNumber(
      afterData,
      STOCK_THRESHOLD_FIELDS,
    );

    if (
      afterQuantity === null ||
      afterThreshold === null
    ) {
      logger.warn(
        "Low-stock notification skipped because quantity or threshold is missing.",
        {
          partId,
          eventId: event.id,
          quantityFields: STOCK_QUANTITY_FIELDS,
          thresholdFields: STOCK_THRESHOLD_FIELDS,
        },
      );

      return;
    }

    const isCurrentlyLow =
      afterQuantity <= afterThreshold;

    if (!isCurrentlyLow) {
      return;
    }

    let wasPreviouslyLow = false;

    if (beforeSnapshot.exists) {
      const beforeData = beforeSnapshot.data();

      if (beforeData) {
        const beforeQuantity = readNumber(
          beforeData,
          STOCK_QUANTITY_FIELDS,
        );

        const beforeThreshold = readNumber(
          beforeData,
          STOCK_THRESHOLD_FIELDS,
        );

        if (
          beforeQuantity !== null &&
          beforeThreshold !== null
        ) {
          wasPreviouslyLow =
            beforeQuantity <= beforeThreshold;
        }
      }
    }

    /**
     * The part was already low before this update.
     * Do not create another alert.
     */
    if (wasPreviouslyLow) {
      return;
    }

    const partName =
      readString(afterData, [
        "name",
        "partName",
        "itemName",
      ]) ?? "Part";

    const notificationCount =
      await createBranchNotifications({
        branchId,

        type: "LOW_STOCK",

        title: "Low stock",

        message:
          `${partName} has only ${afterQuantity} ` +
          `item${afterQuantity === 1 ? "" : "s"} remaining.`,

        targetType: "PART",
        targetId: partId,

        relatedPartId: partId,

        sourceEventId:
          `low-stock:${partId}:${event.id}`,
      });

    logger.info(
      "Low-stock notifications created.",
      {
        branchId,
        partId,
        quantity: afterQuantity,
        threshold: afterThreshold,
        notificationCount,
        eventId: event.id,
      },
    );
  },
);

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

function readNumber(
  data: DocumentData,
  fields: readonly string[],
): number | null {
  for (const field of fields) {
    const value = data[field];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      const parsedValue = Number(value);

      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return null;
}