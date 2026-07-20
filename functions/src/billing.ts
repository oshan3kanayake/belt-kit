/**
 * Billing — generate an invoice from a completed job card.
 * ----------------------------------------------------------------------------
 * This is the classic "business rule that must live server-side" (spec 5.1):
 * the frontend never builds an invoice itself. It calls this function, which
 * reads the job card + its line items, freezes them into an invoice snapshot,
 * applies the branch tax rate, and writes an audit entry — all atomically.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Branch, JobCard, JobCardLine, Part, Role } from "./types";
import { writeAudit } from "./audit";

export const generateInvoice = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) throw new HttpsError("unauthenticated", "Sign in first.");

  const role = caller.token.role as Role | undefined;
  const callerBranch = caller.token.branchId as string | undefined;

  // Per the permission matrix, only owner/manager/accountant do financial actions.
  if (!role || !["owner", "manager", "accountant"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Only owner, manager or accountant can generate invoices."
    );
  }

  const { jobCardId } = request.data as { jobCardId: string };
  if (!jobCardId) {
    throw new HttpsError("invalid-argument", "jobCardId is required.");
  }

  const db = getFirestore();
  const jobRef = db.collection("jobCards").doc(jobCardId);

  const result = await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) {
      throw new HttpsError("not-found", "Job card not found.");
    }
    const job = jobSnap.data() as JobCard;

    // Branch isolation: non-owners can only invoice their own branch's jobs.
    if (role !== "owner" && callerBranch !== job.branchId) {
      throw new HttpsError("permission-denied", "Job card is in another branch.");
    }
    if (job.invoiceId) {
      throw new HttpsError(
        "failed-precondition",
        "This job card already has an invoice."
      );
    }

    // Read branch for currency + tax rate.
    const branchSnap = await tx.get(
      db.collection("branches").doc(job.branchId)
    );
    if (!branchSnap.exists) {
      throw new HttpsError("failed-precondition", "Branch settings missing.");
    }
    const branch = branchSnap.data() as Branch;
    if (
      !Number.isFinite(branch.taxRatePercent) ||
      branch.taxRatePercent < 0 ||
      branch.taxRatePercent > 100
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Set a valid branch tax rate between 0% and 100% before invoicing."
      );
    }

    // Read all line items for this job card.
    const linesSnap = await tx.get(
      db.collection("jobCardLines").where("jobCardId", "==", jobCardId)
    );
    if (linesSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot invoice a job card with no line items."
      );
    }

    // Freeze part costs as well as selling prices so profit reports remain
    // historically correct if catalogue costs change later.
    const jobLines = linesSnap.docs
      .map((d) => d.data() as JobCardLine)
      .filter((line) => !line.archived);
    if (jobLines.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot invoice a job card with no active line items."
      );
    }
    const partIds = Array.from(
      new Set(
        jobLines
          .filter((line) => line.kind === "part" && line.partId)
          .map((line) => line.partId as string)
      )
    );
    const partSnaps = await Promise.all(
      partIds.map((partId) => tx.get(db.collection("parts").doc(partId)))
    );
    const partCosts = new Map<string, number>();
    partSnaps.forEach((snap) => {
      if (snap.exists) {
        partCosts.set(snap.id, (snap.data() as Part).costPriceMinor ?? 0);
      }
    });

    // Freeze line snapshot + compute totals from stored (historical) prices.
    let subtotalMinor = 0;
    const lines = jobLines.map((l) => {
      subtotalMinor += l.lineTotalMinor;
      const costPriceMinor = l.partId ? partCosts.get(l.partId) : undefined;
      return {
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        lineTotalMinor: l.lineTotalMinor,
        kind: l.kind,
        ...(l.partId ? { partId: l.partId } : {}),
        ...(costPriceMinor !== undefined ? { costPriceMinor } : {}),
      };
    });

    const taxMinor = Math.round(subtotalMinor * (branch.taxRatePercent / 100));
    const totalMinor = subtotalMinor + taxMinor;

    const invoiceRef = db.collection("invoices").doc();
    tx.set(invoiceRef, {
      branchId: job.branchId,
      jobCardId,
      customerId: job.customerId,
      status: "issued",
      currency: branch.currency,
      subtotalMinor,
      taxMinor,
      totalMinor,
      amountPaidMinor: 0,
      taxRatePercent: branch.taxRatePercent,
      extraCharges: [],
      discountType: "percent",
      discountValue: 0,
      discountMinor: 0,
      lines,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: caller.uid,
      archived: false,
    });

    // Link the invoice back onto the job card.
    tx.update(jobRef, {
      invoiceId: invoiceRef.id,
      subtotalMinor,
      taxMinor,
      totalMinor,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { invoiceId: invoiceRef.id, branchId: job.branchId, totalMinor };
  });

  await writeAudit({
    branchId: result.branchId,
    actorUid: caller.uid,
    action: "invoice.created",
    entityType: "invoice",
    entityId: result.invoiceId,
    after: { jobCardId, totalMinor: result.totalMinor },
  });

  return { ok: true, invoiceId: result.invoiceId };
});
