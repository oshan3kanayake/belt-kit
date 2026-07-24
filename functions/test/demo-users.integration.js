/* eslint-disable no-console */
"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "belt-kit";
const PASSWORD = "beltkit123";
const BRANCH_ID = "main-branch";
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const accounts = [
  ["owner@beltkit.local", "Workshop Owner", "owner"],
  ["manager@beltkit.local", "Branch Manager", "manager"],
  ["advisor@beltkit.local", "Service Advisor", "advisor"],
  ["tech@beltkit.local", "Lead Technician", "technician"],
  ["accounts@beltkit.local", "Cashier", "accountant"],
  ["notification-admin@test.com", "Notification Admin", "advisor"],
  ["local-notification-user@example.test", "Local Notification User", "advisor"],
];

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Demo-user verification must run against emulators.");
}

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

async function signIn(email) {
  const response = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  assert.equal(response.status, 200, `${email}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  for (const [email, displayName, role] of accounts) {
    const user = await auth.getUserByEmail(email);
    const profileSnapshot = await db.collection("users").doc(user.uid).get();
    const profile = profileSnapshot.data();
    const matchingProfiles = await db.collection("users").where("email", "==", email).get();
    assert.equal(profileSnapshot.exists, true);
    assert.equal(matchingProfiles.size, 1, `${email}: expected exactly one user profile`);
    assert.equal(matchingProfiles.docs[0].id, user.uid, `${email}: profile UID must match Auth UID`);
    assert.equal(profile.email, email);
    assert.equal(profile.displayName, displayName);
    assert.equal(profile.role, role);
    assert.equal(profile.branchId, BRANCH_ID);
    assert.equal(profile.active, true);
    assert.ok(profile.createdAt);
    assert.equal(user.customClaims?.role, role);
    assert.equal(user.customClaims?.branchId, BRANCH_ID);

    const session = await signIn(email);
    assert.equal(session.localId, user.uid);
    const decoded = await auth.verifyIdToken(session.idToken);
    assert.equal(decoded.role, role);
    assert.equal(decoded.branchId, BRANCH_ID);
    console.log(`PASS ${email} signs in as ${role}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
