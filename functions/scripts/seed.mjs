/**
 * BELT-KIT — Seed the default role accounts.
 * ----------------------------------------------------------------------------
 * Creates one user per role (owner, manager, advisor, technician, accountant)
 * with a shared demo password, sets their custom claims (role + branchId), and
 * writes a matching /users doc + the default branch.
 *
 * WHY a script: creating auth users and setting claims must use the Admin SDK,
 * which cannot run in the browser. This is the free way to bootstrap accounts
 * without deploying Cloud Functions (no Blaze plan needed).
 *
 * This script is deliberately emulator-only and idempotent. The root
 * `npm run dev` workflow starts the emulators and invokes it automatically.
 */

import admin from "firebase-admin";

const PROJECT_ID = "belt-kit";
const BRANCH_ID = "main-branch";
const DEMO_PASSWORD = "beltkit123";

const ACCOUNTS = [
  { role: "owner", email: "owner@beltkit.local", displayName: "Workshop Owner" },
  { role: "manager", email: "manager@beltkit.local", displayName: "Branch Manager" },
  { role: "advisor", email: "advisor@beltkit.local", displayName: "Service Advisor" },
  { role: "technician", email: "tech@beltkit.local", displayName: "Lead Technician" },
  { role: "accountant", email: "accounts@beltkit.local", displayName: "Cashier" },
  { role: "advisor", email: "notification-admin@test.com", displayName: "Notification Admin" },
  { role: "advisor", email: "local-notification-user@example.test", displayName: "Local Notification User" },
];

if (process.argv.includes("--cloud")) {
  throw new Error("[seed] Refusing --cloud: demo seeding is emulator-only.");
}

if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
) {
  throw new Error(
    "[seed] Refusing to run: FIREBASE_AUTH_EMULATOR_HOST and " +
    "FIRESTORE_EMULATOR_HOST must both be set.",
  );
}

const isLoopbackEmulator = (value) =>
  /^(127\.0\.0\.1|localhost):\d+$/.test(value ?? "");

if (
  !isLoopbackEmulator(process.env.FIRESTORE_EMULATOR_HOST) ||
  !isLoopbackEmulator(process.env.FIREBASE_AUTH_EMULATOR_HOST)
) {
  throw new Error("[seed] Refusing to run: emulator hosts must be loopback addresses.");
}

if (process.env.GCLOUD_PROJECT !== PROJECT_ID) {
  throw new Error(
    `[seed] Refusing unexpected project ${process.env.GCLOUD_PROJECT ?? "(unset)"}; ` +
    `expected ${PROJECT_ID}.`,
  );
}

admin.initializeApp({ projectId: PROJECT_ID });
console.log(
  `[seed] Using LOCAL EMULATOR (auth:${process.env.FIREBASE_AUTH_EMULATOR_HOST}, ` +
  `firestore:${process.env.FIRESTORE_EMULATOR_HOST})`,
);

const auth = admin.auth();
const db = admin.firestore();

async function ensureUser(acc) {
  let userRecord;
  let created = false;
  const repairs = [];
  try {
    userRecord = await auth.getUserByEmail(acc.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    userRecord = await auth.createUser({
      email: acc.email,
      password: DEMO_PASSWORD,
      displayName: acc.displayName,
      emailVerified: true,
    });
    created = true;
  }

  if (!created) {
    if (userRecord.displayName !== acc.displayName) repairs.push("Auth display name");
    if (!userRecord.emailVerified) repairs.push("Auth email verification");
    if (userRecord.disabled) repairs.push("Auth disabled state");
    if (!(await passwordWorks(acc.email))) repairs.push("Auth password");

    // Resetting the password is intentional: every normal start repairs demo
    // credentials even though Firebase Admin cannot read password hashes.
    userRecord = await auth.updateUser(userRecord.uid, {
      email: acc.email,
      password: DEMO_PASSWORD,
      displayName: acc.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  // Set role + branch as custom claims (what the security rules trust).
  const existingClaims = userRecord.customClaims ?? {};
  if (existingClaims.role !== acc.role || existingClaims.branchId !== BRANCH_ID) {
    repairs.push("Auth claims");
    await auth.setCustomUserClaims(userRecord.uid, {
      ...existingClaims,
      role: acc.role,
      branchId: BRANCH_ID,
    });
  }

  // Mirror into Firestore so the Users screen can list them.
  const profileReference = db.collection("users").doc(userRecord.uid);
  const staleProfiles = await db
    .collection("users")
    .where("email", "==", acc.email)
    .get();
  for (const staleProfile of staleProfiles.docs) {
    if (staleProfile.id !== userRecord.uid) {
      await staleProfile.ref.delete();
      repairs.push("stale demo profile");
    }
  }
  const existingProfile = await profileReference.get();
  const profile = existingProfile.data();
  if (!existingProfile.exists) repairs.push("Firestore profile");
  else if (
    profile?.branchId !== BRANCH_ID ||
    profile?.role !== acc.role ||
    profile?.displayName !== acc.displayName ||
    profile?.email !== acc.email ||
    profile?.active !== true ||
    !profile?.createdAt
  ) repairs.push("Firestore profile");

  await profileReference.set(
    {
      branchId: BRANCH_ID,
      role: acc.role,
      displayName: acc.displayName,
      email: acc.email,
      active: true,
      createdAt:
        existingProfile.data()?.createdAt ??
        admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const outcome = created ? "created" : repairs.length ? `repaired ${repairs.join(", ")}` : "already valid";
  console.log(`[seed] ${acc.email}: ${outcome}`);
}

async function signIn(acc) {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}` +
    "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: acc.email,
        password: DEMO_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`[seed] ${acc.email}: sign-in verification failed: ${body?.error?.message ?? response.status}`);
  }
  return body;
}

async function passwordWorks(email) {
  try {
    await signIn({ email });
    return true;
  } catch {
    return false;
  }
}

async function verifyUser(acc) {
  const userRecord = await auth.getUserByEmail(acc.email);
  const profile = (await db.collection("users").doc(userRecord.uid).get()).data();
  const claims = userRecord.customClaims ?? {};
  if (
    profile?.email !== acc.email ||
    profile?.displayName !== acc.displayName ||
    profile?.role !== acc.role ||
    profile?.branchId !== BRANCH_ID ||
    profile?.active !== true ||
    claims.role !== acc.role ||
    claims.branchId !== BRANCH_ID
  ) {
    throw new Error(`Demo account verification failed: ${acc.email}`);
  }
  const session = await signIn(acc);
  const decodedToken = await auth.verifyIdToken(session.idToken);
  if (
    session.localId !== userRecord.uid ||
    decodedToken.role !== acc.role ||
    decodedToken.branchId !== BRANCH_ID
  ) {
    throw new Error(`[seed] ${acc.email}: fresh-token claims verification failed.`);
  }
  console.log(`[seed] ${acc.email}: verified login, profile, and fresh claims`);
}

async function main() {
  // Default branch (Sri Lanka defaults).
  const branchReference = db.collection("branches").doc(BRANCH_ID);
  const existingBranch = await branchReference.get();
  await db.collection("branches").doc(BRANCH_ID).set(
    {
      name: "Main Branch",
      currency: "LKR",
      taxRatePercent: 18, // Sri Lanka VAT (adjust as needed)
      timezone: "Asia/Colombo",
      createdAt:
        existingBranch.data()?.createdAt ??
        admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
    },
    { merge: true }
  );
  console.log(`[seed] Branch ready: ${BRANCH_ID} (LKR, Asia/Colombo)`);

  for (const acc of ACCOUNTS) {
    await ensureUser(acc);
  }

  for (const acc of ACCOUNTS) {
    await verifyUser(acc);
  }

  console.log("[seed] All demo accounts ready");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
