/**
 * Audit trail helper.
 * The spec requires that every write to Invoice, Payment, Stock and JobCard
 * status automatically creates an AuditLogEntry. Because this runs with the
 * Admin SDK inside a Function, it bypasses security rules — and the rules
 * forbid clients from writing to /auditLog at all, so the trail is tamper-proof.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function writeAudit(params: {
  branchId: string;
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  const db = getFirestore();
  await db.collection("auditLog").add({
    branchId: params.branchId,
    actorUid: params.actorUid,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
    at: FieldValue.serverTimestamp(),
  });
}
