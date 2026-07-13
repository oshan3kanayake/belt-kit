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
 * HOW TO RUN — against the local emulator (recommended, free):
 *   1. In terminal A:  cd functions && npm run serve      (leave running)
 *   2. In terminal B:  cd functions && npm run seed
 *
 * HOW TO RUN — against real cloud (needs a service-account key file):
 *   1. Firebase console → Project settings → Service accounts →
 *      "Generate new private key" → save as functions/serviceAccountKey.json
 *   2. cd functions && npm run seed:cloud
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BRANCH_ID = "main";
const DEMO_PASSWORD = "beltkit123";

const ACCOUNTS = [
  { role: "owner", email: "owner@beltkit.local", displayName: "Workshop Owner" },
  { role: "manager", email: "manager@beltkit.local", displayName: "Branch Manager" },
  { role: "advisor", email: "advisor@beltkit.local", displayName: "Service Advisor" },
  { role: "technician", email: "tech@beltkit.local", displayName: "Lead Technician" },
  { role: "accountant", email: "accounts@beltkit.local", displayName: "Cashier" },
];

const useCloud = process.argv.includes("--cloud");

if (useCloud) {
  const keyPath = join(__dirname, "..", "serviceAccountKey.json");
  if (!existsSync(keyPath)) {
    console.error(
      "\n  Missing serviceAccountKey.json. Download it from the Firebase " +
        "console (Project settings → Service accounts) and place it in the " +
        "functions/ folder.\n"
    );
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "belt-kit",
  });
  console.log("→ Seeding REAL CLOUD project: belt-kit");
} else {
  // Point the Admin SDK at the local emulators.
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  admin.initializeApp({ projectId: "belt-kit" });
  console.log("→ Seeding LOCAL EMULATOR (auth:9099, firestore:8080)");
}

const auth = admin.auth();
const db = admin.firestore();

async function ensureUser(acc) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(acc.email);
    console.log(`  • exists: ${acc.email}`);
  } catch {
    userRecord = await auth.createUser({
      email: acc.email,
      password: DEMO_PASSWORD,
      displayName: acc.displayName,
      emailVerified: true,
    });
    console.log(`  ✓ created: ${acc.email}`);
  }

  // Set role + branch as custom claims (what the security rules trust).
  await auth.setCustomUserClaims(userRecord.uid, {
    role: acc.role,
    branchId: BRANCH_ID,
  });

  // Mirror into Firestore so the Users screen can list them.
  await db.collection("users").doc(userRecord.uid).set(
    {
      branchId: BRANCH_ID,
      role: acc.role,
      displayName: acc.displayName,
      email: acc.email,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function main() {
  // Default branch (Sri Lanka defaults).
  await db.collection("branches").doc(BRANCH_ID).set(
    {
      name: "Main Branch",
      currency: "LKR",
      taxRatePercent: 18, // Sri Lanka VAT (adjust as needed)
      timezone: "Asia/Colombo",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
    },
    { merge: true }
  );
  console.log(`  ✓ branch ready: ${BRANCH_ID} (LKR, Asia/Colombo)`);

  for (const acc of ACCOUNTS) {
    await ensureUser(acc);
  }

  console.log("\n  Done. Sign in with any email above + password:", DEMO_PASSWORD, "\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
