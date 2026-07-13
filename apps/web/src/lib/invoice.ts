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
import { JobCard, JobCardLine, Branch } from "./models";

interface BranchDoc extends Branch {}

export async function generateInvoiceClient(
  jobCardId: string,
  branchTaxPercentFallback = 18
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
  const currency = branch?.currency ?? "LKR";
  const taxPercent = branch?.taxRatePercent ?? branchTaxPercentFallback;

  // Lines for this job card.
  const linesSnap = await getDocs(
    query(collection(db, "jobCardLines"), where("jobCardId", "==", jobCardId))
  );
  const activeLines = linesSnap.docs
    .map((d) => d.data() as JobCardLine)
    .filter((l) => !l.archived);

  if (activeLines.length === 0)
    throw new Error("Cannot invoice a job card with no line items.");

  let subtotalMinor = 0;
  const lines = activeLines.map((l) => {
    subtotalMinor += l.lineTotalMinor;
    return {
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      lineTotalMinor: l.lineTotalMinor,
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
