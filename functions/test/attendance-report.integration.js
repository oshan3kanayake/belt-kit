/* eslint-disable no-console */
"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "belt-kit";
const PASSWORD = "Local-only-Password-123!";
const FUNCTIONS_PORT = process.env.ATTENDANCE_REPORT_FUNCTIONS_PORT || "5001";
const FUNCTIONS_BASE = `http://127.0.0.1:${FUNCTIONS_PORT}/${PROJECT_ID}/us-central1`;
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`;
const runId = `attendance-pdf-${Date.now()}-${randomUUID().slice(0, 8)}`;

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("This test must run through Firebase emulators:exec.");
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
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(typeof body.idToken, "string");
  return body.idToken;
}

function makeExpiredEmulatorToken(token) {
  const [header, payload] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  claims.iat = Math.floor(Date.now() / 1000) - 7200;
  claims.exp = Math.floor(Date.now() / 1000) - 3600;
  return `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.`;
}

async function requestReport(token) {
  return fetch(`${FUNCTIONS_BASE}/downloadAttendanceReport?reportType=month&month=2026-07`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function main() {
  const email = `${runId}@example.test`;
  const user = await auth.createUser({ email, password: PASSWORD, displayName: "PDF Admin" });
  await db.collection("users").doc(user.uid).set({
    email,
    displayName: "PDF Admin",
    role: "owner",
    branchId: `${runId}-branch`,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("attendance").doc(`${runId}-attendance`).set({
    employeeId: user.uid,
    branchId: `${runId}-branch`,
    date: "2026-07-15",
    status: "present",
    note: "Regression test",
  });

  const freshToken = await signIn(email);

  const noToken = await requestReport();
  assert.equal(noToken.status, 401);
  console.log("PASS no token returns 401 UNAUTHENTICATED");

  const expiredToken = await requestReport(makeExpiredEmulatorToken(freshToken));
  assert.equal(expiredToken.status, 401);
  console.log("PASS expired token returns 401 UNAUTHENTICATED");

  const validToken = await requestReport(freshToken);
  assert.equal(validToken.status, 200, validToken.statusText);
  assert.match(validToken.headers.get("content-type") || "", /^application\/pdf/);
  const pdf = Buffer.from(await validToken.arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  console.log("PASS fresh Auth emulator ID token returns 200 application/pdf");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
