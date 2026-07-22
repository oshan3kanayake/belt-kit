/* eslint-disable no-console */
"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "belt-kit";
const PORT = process.env.ATTENDANCE_FUNCTIONS_PORT || "5001";
const BASE = `http://127.0.0.1:${PORT}/${PROJECT_ID}/us-central1`;
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const PASSWORD = "Local-only-Password-123!";
const runId = `attendance-workflow-${Date.now()}-${randomUUID().slice(0, 8)}`;
const branchId = `${runId}-main`;
const otherBranchId = `${runId}-other`;

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("This test requires Auth and Firestore emulators.");
}

initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

async function createUser(label, role, branch) {
  const email = `${label}.${runId}@example.test`;
  const user = await auth.createUser({ email, password: PASSWORD, displayName: label });
  await auth.setCustomUserClaims(user.uid, { role, branchId: branch });
  await db.collection("users").doc(user.uid).set({ email, displayName: label, role, branchId: branch, active: true });
  return { uid: user.uid, email };
}

async function signIn(user) {
  const response = await fetch(`${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.idToken;
}

async function callable(name, data, token) {
  const response = await fetch(`${BASE}/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  return { status: response.status, data: body.result ?? body.data, error: body.error };
}

async function main() {
  const owner = await createUser("owner", "owner", branchId);
  const employee = await createUser("employee", "technician", branchId);
  const otherEmployee = await createUser("other", "technician", otherBranchId);
  const token = await signIn(owner);
  const date = "2026-07-22";

  const created = await callable("createAttendance", { employeeId: employee.uid, date, status: "present", note: "Initial" }, token);
  assert.equal(created.status, 200, JSON.stringify(created.error));
  assert.equal(created.data.operation, "created");

  const updated = await callable("createAttendance", { employeeId: employee.uid, date, status: "on_leave", note: "Updated" }, token);
  assert.equal(updated.status, 200, JSON.stringify(updated.error));
  assert.equal(updated.data.operation, "updated");

  const attendance = await db.collection("attendance").where("employeeId", "==", employee.uid).where("date", "==", date).get();
  assert.equal(attendance.size, 1);
  assert.equal(attendance.docs[0].data().status, "on_leave");
  assert.equal(attendance.docs[0].data().note, "Updated");
  console.log("PASS update reuses one employee/date attendance document");

  await db.collection("attendance").doc(`${otherEmployee.uid}_${date}`).set({ employeeId: otherEmployee.uid, branchId: otherBranchId, date, status: "present", note: "Other branch" });
  const list = await callable("getAttendanceList", { month: "2026-07" }, token);
  assert.equal(list.status, 200, JSON.stringify(list.error));
  assert.equal(list.data.attendance.length, 1);
  assert.equal(list.data.attendance[0].branchId, branchId);
  console.log("PASS attendance list is scoped to authenticated branch");

  const employeeList = await callable("getEmployees", { branchScoped: true }, token);
  assert.equal(employeeList.status, 200, JSON.stringify(employeeList.error));
  assert.equal(employeeList.data.employees.some((item) => item.id === employee.uid), true);
  assert.equal(employeeList.data.employees.some((item) => item.id === otherEmployee.uid), false);
  console.log("PASS attendance employee list is scoped before reaching the UI");

  const forbidden = await callable("createAttendance", { employeeId: otherEmployee.uid, date, status: "present" }, token);
  assert.equal(forbidden.status, 403);
  console.log("PASS cross-branch attendance update is denied");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
