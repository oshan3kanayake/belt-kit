/**
 * Job card triggers.
 * ----------------------------------------------------------------------------
 * Firestore triggers run automatically whenever a job card changes — no client
 * has to remember to call them. Here we audit every status change, satisfying
 * the spec rule "every write to JobCard status creates an AuditLogEntry".
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { JobCard } from "./types";

export const onJobCardStatusChange = onDocumentUpdated(
  "jobCards/{jobCardId}",
  async (event) => {
    const before = event.data?.before.data() as JobCard | undefined;
    const after = event.data?.after.data() as JobCard | undefined;
    if (!before || !after) return;

    // Only care about status transitions.
    if (before.status === after.status) return;

    const db = getFirestore();
    await db.collection("auditLog").add({
      branchId: after.branchId,
      // We can't know the acting user inside a trigger reliably, so we record
      // the last writer captured on the doc (updatedByUid), if present.
      actorUid: (after as unknown as { updatedByUid?: string }).updatedByUid ?? "system",
      action: "jobCard.status_changed",
      entityType: "jobCard",
      entityId: event.params.jobCardId,
      before: { status: before.status },
      after: { status: after.status },
      at: FieldValue.serverTimestamp(),
    });
  }
);
