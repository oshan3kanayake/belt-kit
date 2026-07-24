/**
 * Firebase CLIENT SDK setup (browser-side).
 * ----------------------------------------------------------------------------
 * Config values are PUBLIC (safe in the browser) — access is controlled by
 * Auth + security rules.
 *
 * Firestore is created with experimentalForceLongPolling to avoid the
 * "FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state" WebChannel bug.
 *
 * IMPORTANT: the Add-Member flow spins up a SECONDARY named Firebase app, so we
 * must key everything to the DEFAULT app by name (not getApps().length), or the
 * default Firestore could get re-created without the long-polling setting.
 */

import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "belt-kit",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// The DEFAULT app is named "[DEFAULT]". Check for it by name so a secondary
// named app (from Add Member) never confuses this logic.
const DEFAULT = "[DEFAULT]";
const defaultExists = getApps().some((a) => a.name === DEFAULT);
const app: FirebaseApp = defaultExists ? getApp() : initializeApp(firebaseConfig);

// Create Firestore with forced long-polling. initializeFirestore throws if
// called twice on the same app, so only call it when we just created the app;
// otherwise reuse the already-initialized instance.
let _db: Firestore;
try {
  _db = defaultExists
    ? getFirestore(app)
    : initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  // Already initialized (e.g. Fast Refresh) — just get it.
  _db = getFirestore(app);
}
export const db = _db;

export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Wire to the local emulator when asked (only in the browser, only once).
const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === "true";
const functionsEmulatorOnly =
  process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true";

if (typeof window !== "undefined") {
  const w = window as unknown as { __beltkitEmulated?: boolean };
  if (!w.__beltkitEmulated) {
    if (useEmulator) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    } else if (functionsEmulatorOnly) {
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    }
    w.__beltkitEmulated = true;
  }
}

export default app;
