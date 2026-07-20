"use client";

/**
 * Client-side invoice generation (free-tier, no Cloud Function needed).
 * ----------------------------------------------------------------------------
 * Mirrors what functions/src/billing.ts does, but runs in the browser against
 * Firestore under your security rules (owner/manager/accountant may create
 * invoices). It reads the job card + its lines, freezes them into an invoice
 * snapshot with tax applied, links the invoice back onto the job card, and
 * writes a best-effort audit entry.
 *
 * Trade-off vs. the server function: the audit entry here is written by the
 * client rather than a trusted server, so it is advisory rather than tamper-
 * proof. When you move to Blaze, switch back to the generateInvoice function
 * for a hardened audit trail.
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { JobCard, JobCardLine, Branch, Part } from "./models";

interface BranchDoc extends Branch {}

export async function generateInvoiceClient(
  jobCardId: string
): Promise<string> {
  const jobRef = doc(db, "jobCards", jobCardId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error("Job card not found.");
  const job = jobSnap.data() as JobCard;

  if (job.invoiceId) throw new Error("This job card already has an invoice.");

  // Branch (for currency + tax rate).
  const branchSnap = await getDoc(doc(db, "branches", job.branchId));
  const branch = branchSnap.exists()
    ? (branchSnap.data() as BranchDoc)
    : null;
  if (!branch) {
    throw new Error("Branch settings could not be found. Set the branch tax rate before invoicing.");
  }
  if (
    typeof branch.taxRatePercent !== "number" ||
    !Number.isFinite(branch.taxRatePercent) ||
    branch.taxRatePercent < 0 ||
    branch.taxRatePercent > 100
  ) {
    throw new Error("Set a valid branch tax rate between 0% and 100% before invoicing.");
  }
  const currency = branch.currency || "LKR";
  const taxPercent = branch.taxRatePercent;

  // Lines for this job card.
  const linesSnap = await getDocs(
    query(collection(db, "jobCardLines"), where("jobCardId", "==", jobCardId))
  );
  const activeLines = linesSnap.docs
    .map((d) => d.data() as JobCardLine)
    .filter((l) => !l.archived);

  if (activeLines.length === 0)
    throw new Error("Cannot invoice a job card with no line items.");

  // Freeze part costs as well as selling prices so future profit reports do not
  // change when the inventory catalogue is edited.
  const partIds = Array.from(
    new Set(
      activeLines
        .filter((line) => line.kind === "part" && line.partId)
        .map((line) => line.partId as string)
    )
  );
  const partSnaps = await Promise.all(
    partIds.map((partId) => getDoc(doc(db, "parts", partId)))
  );
  const partCosts = new Map<string, number>();
  partSnaps.forEach((snap) => {
    if (snap.exists()) {
      partCosts.set(snap.id, (snap.data() as Part).costPriceMinor ?? 0);
    }
  });

  let subtotalMinor = 0;
  const lines = activeLines.map((l) => {
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

  const taxMinor = Math.round(subtotalMinor * (taxPercent / 100));
  const totalMinor = subtotalMinor + taxMinor;
  const uid = auth.currentUser?.uid ?? "unknown";

  // Atomic: create the invoice and link it back onto the job card together.
  const invoiceRef = doc(collection(db, "invoices"));
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(jobRef);
    if (fresh.exists() && (fresh.data() as JobCard).invoiceId) {
      throw new Error("This job card already has an invoice.");
    }
    tx.set(invoiceRef, {
      branchId: job.branchId,
      jobCardId,
      customerId: job.customerId,
      status: "issued",
      currency,
      subtotalMinor,
      taxMinor,
      totalMinor,
      amountPaidMinor: 0,
      taxRatePercent: taxPercent,
      extraCharges: [],
      discountType: "percent",
      discountValue: 0,
      discountMinor: 0,
      lines,
      archived: false,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(jobRef, {
      invoiceId: invoiceRef.id,
      subtotalMinor,
      taxMinor,
      totalMinor,
      updatedAt: serverTimestamp(),
    });
  });

  return invoiceRef.id;
}
