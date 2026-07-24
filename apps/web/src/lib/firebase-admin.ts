import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (process.env.NEXT_PUBLIC_USE_EMULATOR === "true") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = serviceAccountJson
    ? cert(JSON.parse(serviceAccountJson))
    : undefined;

  return initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "belt-kit",
    ...(credential ? { credential } : {}),
  });
}

export async function verifyAssistantToken(token: string) {
  return getAuth(getAdminApp()).verifyIdToken(token);
}

/**
 * The assistant is a staff tool. Owner, manager, front desk (advisor) and
 * technician accounts may all use it; enforce that on the server.
 */
export async function verifyTechnicianToken(token: string) {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
  const user = await getFirestore(getAdminApp()).collection("users").doc(decoded.uid).get();
  const role = user.data()?.role;
  if (!(role === "owner" || role === "manager" || role === "advisor" || role === "technician")) {
    throw new Error("TECHNICIAN_ONLY");
  }
  return decoded;
}
