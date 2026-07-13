/**
 * User & role management.
 * ----------------------------------------------------------------------------
 * A user's role and branch live in Firebase Auth "custom claims". Clients
 * cannot set their own claims — only the Admin SDK (here) can. The security
 * rules read these claims to decide who can do what. This is the backbone of
 * the whole RBAC system.
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Role } from "./types";
import { writeAudit } from "./audit";

const ASSIGNABLE_ROLES: Role[] = [
  "owner",
  "manager",
  "advisor",
  "technician",
  "accountant",
];

/**
 * Callable function: assign a role + branch to a user.
 * Only an owner (or a manager acting within their own branch) may call this.
 * Bootstrapping note: the very FIRST owner is set with the one-off
 * `bootstrapFirstOwner` function below, because at that point no owner exists.
 */
export const setUserRole = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerRole = caller.token.role as Role | undefined;
  const callerBranch = caller.token.branchId as string | undefined;

  const { targetUid, role, branchId, displayName, email } = request.data as {
    targetUid: string;
    role: Role;
    branchId: string;
    displayName?: string;
    email?: string;
  };

  if (!targetUid || !role || !branchId) {
    throw new HttpsError(
      "invalid-argument",
      "targetUid, role and branchId are required."
    );
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", `Unknown role: ${role}`);
  }

  // Permission check: owner can assign anyone anywhere; manager only within
  // their own branch, and cannot create owners.
  const allowed =
    callerRole === "owner" ||
    (callerRole === "manager" &&
      callerBranch === branchId &&
      role !== "owner");
  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      "You are not allowed to assign this role."
    );
  }

  // Set the custom claims (this is what the security rules trust).
  await getAuth().setCustomUserClaims(targetUid, { role, branchId });

  // Mirror into a Firestore /users doc so staff lists are queryable.
  const db = getFirestore();
  await db.collection("users").doc(targetUid).set(
    {
      branchId,
      role,
      displayName: displayName ?? "",
      email: email ?? "",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAudit({
    branchId,
    actorUid: caller.uid,
    action: "user.role_assigned",
    entityType: "user",
    entityId: targetUid,
    after: { role, branchId },
  });

  return { ok: true, targetUid, role, branchId };
});

/**
 * ONE-TIME bootstrap: promote the first user to owner.
 * Safe because it refuses to run if any owner already exists. Use this once
 * right after you create your own login, then never again.
 */
export const bootstrapFirstOwner = onCall(async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }

  const { branchId, branchName, currency, timezone } = request.data as {
    branchId: string;
    branchName?: string;
    currency?: string;
    timezone?: string;
  };
  if (!branchId) {
    throw new HttpsError("invalid-argument", "branchId is required.");
  }

  const db = getFirestore();

  // Refuse if an owner already exists anywhere.
  const existingOwner = await db
    .collection("users")
    .where("role", "==", "owner")
    .limit(1)
    .get();
  if (!existingOwner.empty) {
    throw new HttpsError(
      "failed-precondition",
      "An owner already exists. Use setUserRole instead."
    );
  }

  // Create the branch if it doesn't exist yet.
  await db.collection("branches").doc(branchId).set(
    {
      name: branchName ?? "Main Branch",
      currency: currency ?? "LKR",
      taxRatePercent: 0,
      timezone: timezone ?? "Asia/Colombo",
      createdAt: FieldValue.serverTimestamp(),
      archived: false,
    },
    { merge: true }
  );

  await getAuth().setCustomUserClaims(caller.uid, {
    role: "owner",
    branchId,
  });

  await db.collection("users").doc(caller.uid).set(
    {
      branchId,
      role: "owner",
      displayName: caller.token.name ?? "",
      email: caller.token.email ?? "",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAudit({
    branchId,
    actorUid: caller.uid,
    action: "user.bootstrap_owner",
    entityType: "user",
    entityId: caller.uid,
    after: { role: "owner", branchId },
  });

  return {
    ok: true,
    message: "You are now the owner. Sign out and back in to refresh your token.",
  };
});
