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

  return userRecord.uid;
}

function timestampDaysAgo(daysAgo, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return admin.firestore.Timestamp.fromDate(date);
}

async function seedDemoData(userIds) {
  const ownerUid = userIds.get("owner");
  const technicianUid = userIds.get("technician");
  const now = admin.firestore.FieldValue.serverTimestamp();

  const customers = [
    ["customer-perera", { displayName: "Nimal Perera", phone: "0771234567", email: "nimal@example.test", preferredChannel: "whatsapp", segment: "vip" }],
    ["customer-silva", { displayName: "Shenali Silva", phone: "0719876543", email: "shenali@example.test", preferredChannel: "sms", segment: "walkin" }],
    ["customer-fernando", { displayName: "Ruwan Fernando", phone: "0765558123", email: "ruwan@example.test", preferredChannel: "email", segment: "fleet" }],
  ];
  const vehicles = [
    ["vehicle-perera", { customerId: "customer-perera", plateNumber: "CAB-4821", make: "Toyota", model: "Aqua", year: 2016, engine: "1500cc Hybrid" }],
    ["vehicle-silva", { customerId: "customer-silva", plateNumber: "CAA-9087", make: "Honda", model: "Fit", year: 2015, engine: "1300cc" }],
    ["vehicle-fernando", { customerId: "customer-fernando", plateNumber: "CAR-3310", make: "Suzuki", model: "Wagon R", year: 2018, engine: "1000cc" }],
  ];
  const parts = [
    ["part-engine-oil", { sku: "OIL-5W30", name: "Engine Oil 5W-30", costPriceMinor: 220000, sellPriceMinor: 350000, quantityOnHand: 18, reorderThreshold: 10, lowStock: false, binLocation: "A-01" }],
    ["part-oil-filter", { sku: "OF-1023", name: "Oil Filter", costPriceMinor: 180000, sellPriceMinor: 300000, quantityOnHand: 6, reorderThreshold: 5, lowStock: false, binLocation: "A-02" }],
    ["part-brake-pad", { sku: "BP-445", name: "Front Brake Pad Set", costPriceMinor: 650000, sellPriceMinor: 950000, quantityOnHand: 2, reorderThreshold: 4, lowStock: true, binLocation: "B-04" }],
    ["part-air-filter", { sku: "AF-210", name: "Air Filter", costPriceMinor: 145000, sellPriceMinor: 240000, quantityOnHand: 0, reorderThreshold: 3, lowStock: true, binLocation: "A-05" }],
  ];

  const writeBatch = db.batch();
  customers.forEach(([id, data]) => writeBatch.set(db.collection("customers").doc(id), {
    ...data, branchId: BRANCH_ID, archived: false, createdAt: timestampDaysAgo(30), updatedAt: now,
  }, { merge: true }));
  vehicles.forEach(([id, data]) => writeBatch.set(db.collection("vehicles").doc(id), {
    ...data, branchId: BRANCH_ID, archived: false, createdAt: timestampDaysAgo(28), updatedAt: now,
  }, { merge: true }));
  parts.forEach(([id, data]) => writeBatch.set(db.collection("parts").doc(id), {
    ...data, branchId: BRANCH_ID, archived: false, createdAt: timestampDaysAgo(20), updatedAt: now,
  }, { merge: true }));
  await writeBatch.commit();

  const jobs = [
    ["job-service-paid", {
      customerId: "customer-perera", vehicleId: "vehicle-perera", complaint: "Regular service and AC cleaning", status: "delivered",
      assignedTechnicianIds: technicianUid ? [technicianUid] : [], subtotalMinor: 2200000, taxMinor: 418950, totalMinor: 2746450,
      invoiceId: "invoice-service-paid", createdAt: timestampDaysAgo(12), updatedAt: now,
    }],
    ["job-brakes-partpaid", {
      customerId: "customer-silva", vehicleId: "vehicle-silva", complaint: "Front brake noise when stopping", status: "ready",
      assignedTechnicianIds: technicianUid ? [technicianUid] : [], subtotalMinor: 1450000, taxMinor: 261000, totalMinor: 1711000,
      invoiceId: "invoice-brakes-partpaid", createdAt: timestampDaysAgo(7), updatedAt: now,
    }],
    ["job-diagnosis-open", {
      customerId: "customer-fernando", vehicleId: "vehicle-fernando", complaint: "Check engine light and rough idle", status: "in_progress",
      assignedTechnicianIds: technicianUid ? [technicianUid] : [], subtotalMinor: 800000, taxMinor: 144000, totalMinor: 944000,
      invoiceId: null, createdAt: timestampDaysAgo(1), updatedAt: now,
    }],
    ["job-invoice-demo-open", {
      customerId: "customer-perera", vehicleId: "vehicle-perera", complaint: "Invoice demo — service package ready for pricing", status: "ready",
      assignedTechnicianIds: technicianUid ? [technicianUid] : [], subtotalMinor: 650000, taxMinor: 117000, totalMinor: 767000,
      invoiceId: null, createdAt: timestampDaysAgo(0, 9), updatedAt: now,
    }],
  ];

  const jobLines = [
    ["line-service-oil", { jobCardId: "job-service-paid", kind: "part", description: "Engine Oil 5W-30", partId: "part-engine-oil", quantity: 4, unitPriceMinor: 350000, lineTotalMinor: 1400000 }],
    ["line-service-filter", { jobCardId: "job-service-paid", kind: "part", description: "Oil Filter", partId: "part-oil-filter", quantity: 1, unitPriceMinor: 300000, lineTotalMinor: 300000 }],
    ["line-service-labour", { jobCardId: "job-service-paid", kind: "labor", description: "Full service labour", quantity: 1, unitPriceMinor: 500000, lineTotalMinor: 500000 }],
    ["line-brakes-pad", { jobCardId: "job-brakes-partpaid", kind: "part", description: "Front Brake Pad Set", partId: "part-brake-pad", quantity: 1, unitPriceMinor: 950000, lineTotalMinor: 950000 }],
    ["line-brakes-labour", { jobCardId: "job-brakes-partpaid", kind: "labor", description: "Brake inspection and fitting", quantity: 1, unitPriceMinor: 500000, lineTotalMinor: 500000 }],
    ["line-diagnosis", { jobCardId: "job-diagnosis-open", kind: "labor", description: "Engine diagnostics", quantity: 1, unitPriceMinor: 800000, lineTotalMinor: 800000 }],
    ["line-invoice-demo-filter", { jobCardId: "job-invoice-demo-open", kind: "part", description: "Oil Filter", partId: "part-oil-filter", quantity: 1, unitPriceMinor: 300000, lineTotalMinor: 300000 }],
    ["line-invoice-demo-labour", { jobCardId: "job-invoice-demo-open", kind: "labor", description: "Service and inspection labour", quantity: 1, unitPriceMinor: 350000, lineTotalMinor: 350000 }],
  ];

  const invoiceLines = {
    service: [
      { description: "Engine Oil 5W-30", quantity: 4, unitPriceMinor: 350000, lineTotalMinor: 1400000, kind: "part", partId: "part-engine-oil", costPriceMinor: 220000 },
      { description: "Oil Filter", quantity: 1, unitPriceMinor: 300000, lineTotalMinor: 300000, kind: "part", partId: "part-oil-filter", costPriceMinor: 180000 },
      { description: "Full service labour", quantity: 1, unitPriceMinor: 500000, lineTotalMinor: 500000, kind: "labor" },
    ],
    brakes: [
      { description: "Front Brake Pad Set", quantity: 1, unitPriceMinor: 950000, lineTotalMinor: 950000, kind: "part", partId: "part-brake-pad", costPriceMinor: 650000 },
      { description: "Brake inspection and fitting", quantity: 1, unitPriceMinor: 500000, lineTotalMinor: 500000, kind: "labor" },
    ],
  };

  const financialBatch = db.batch();
  jobs.forEach(([id, data]) => financialBatch.set(db.collection("jobCards").doc(id), {
    ...data, branchId: BRANCH_ID, archived: false, createdByUid: ownerUid ?? "seed", updatedByUid: ownerUid ?? "seed",
  }, { merge: true }));
  jobLines.forEach(([id, data]) => financialBatch.set(db.collection("jobCardLines").doc(id), {
    ...data, branchId: BRANCH_ID, archived: false, createdAt: timestampDaysAgo(10), updatedAt: now,
  }, { merge: true }));
  financialBatch.set(db.collection("invoices").doc("invoice-service-paid"), {
    branchId: BRANCH_ID, jobCardId: "job-service-paid", customerId: "customer-perera", status: "paid", currency: "LKR",
    subtotalMinor: 2200000, extraCharges: [{ description: "AC cleaning", amountMinor: 250000 }], discountType: "percent", discountValue: 5,
    discountMinor: 122500, taxRatePercent: 18, taxMinor: 418950, totalMinor: 2746450, amountPaidMinor: 2746450,
    lines: invoiceLines.service, archived: false, createdByUid: ownerUid ?? "seed", createdAt: timestampDaysAgo(12), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("invoices").doc("invoice-brakes-partpaid"), {
    branchId: BRANCH_ID, jobCardId: "job-brakes-partpaid", customerId: "customer-silva", status: "part_paid", currency: "LKR",
    subtotalMinor: 1450000, extraCharges: [], discountType: "fixed", discountValue: 0, discountMinor: 0,
    taxRatePercent: 18, taxMinor: 261000, totalMinor: 1711000, amountPaidMinor: 700000,
    lines: invoiceLines.brakes, archived: false, createdByUid: ownerUid ?? "seed", createdAt: timestampDaysAgo(7), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("payments").doc("payment-service-card"), {
    branchId: BRANCH_ID, invoiceId: "invoice-service-paid", customerId: "customer-perera", amountMinor: 2746450, method: "card",
    reference: "DEMO-CARD-SERVICE-01", cardLast4: "4242", provider: "Demo card payment", archived: false,
    createdByUid: ownerUid ?? "seed", createdAt: timestampDaysAgo(9), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("payments").doc("payment-brakes-cash"), {
    branchId: BRANCH_ID, invoiceId: "invoice-brakes-partpaid", customerId: "customer-silva", amountMinor: 700000, method: "cash",
    reference: "CASH-DEMO-02", provider: "Cash counter", archived: false,
    createdByUid: ownerUid ?? "seed", createdAt: timestampDaysAgo(4), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("stockMovements").doc("movement-oil-received"), {
    branchId: BRANCH_ID, partId: "part-engine-oil", delta: 12, reason: "purchase", jobCardId: null, archived: false,
    createdAt: timestampDaysAgo(8), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("stockMovements").doc("movement-brake-adjustment"), {
    branchId: BRANCH_ID, partId: "part-brake-pad", delta: -1, reason: "adjustment", jobCardId: "job-brakes-partpaid", archived: false,
    createdAt: timestampDaysAgo(6), updatedAt: now,
  }, { merge: true });
  financialBatch.set(db.collection("auditLog").doc("audit-demo-payment"), {
    branchId: BRANCH_ID, actorUid: ownerUid ?? "seed", action: "payment.created", entityType: "payment", entityId: "payment-service-card",
    after: { invoiceId: "invoice-service-paid", amountMinor: 2746450, method: "card" }, at: timestampDaysAgo(9),
  }, { merge: true });
  await financialBatch.commit();

  console.log("  ✓ mock customers, vehicles, inventory, job cards, invoices and payments ready");
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

  const userIds = new Map();
  for (const acc of ACCOUNTS) {
    userIds.set(acc.role, await ensureUser(acc));
  }

  await seedDemoData(userIds);

  console.log("\n  Done. Sign in with any email above + password:", DEMO_PASSWORD, "\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
