"use client";

/**
 * Create a staff member WITHOUT logging out the current user (free tier).
 * ----------------------------------------------------------------------------
 * Normally createUserWithEmailAndPassword signs you in as the new user. To
 * avoid that, we spin up a SECONDARY Firebase app instance with the same
 * config, create the account there, write their /users doc, then delete the
 * secondary app. The owner's primary session is never touched.
 */

import { initializeApp, deleteApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Role } from "./auth-context";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "belt-kit",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export async function createStaffMember(params: {
  name: string;
  email: string;
  password: string;
  role: Role;
  branchId: string;
}): Promise<{ uid: string }> {
  // Unique name so we never collide with an existing secondary app.
  const appName = "belt-kit-admin-" + Date.now();
  const secondary = initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      params.email.trim(),
      params.password
    );
    if (params.name.trim()) {
      await updateProfile(cred.user, { displayName: params.name.trim() });
    }

    // Write their /users doc from the PRIMARY app (owner is authorized to do so).
    await setDoc(doc(db, "users", cred.user.uid), {
      role: params.role,
      branchId: params.branchId,
      displayName: params.name.trim() || params.email.trim(),
      email: params.email.trim(),
      active: true,
      createdAt: serverTimestamp(),
    });

    // Sign the new user out of the secondary app and tear it down.
    await signOut(secondaryAuth).catch(() => {});
    return { uid: cred.user.uid };
  } finally {
    // Always clean up the secondary app.
    if (getApps().some((a) => a.name === appName)) {
      await deleteApp(secondary).catch(() => {});
    }
  }
}
