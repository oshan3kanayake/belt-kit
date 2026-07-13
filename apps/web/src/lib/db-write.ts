"use client";

/**
 * Write helpers that automatically stamp the spec-required fields:
 * branchId, createdAt/updatedAt, createdByUid, archived. Keeps every module
 * consistent and honours "archive, never delete".
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";

export async function createDoc(
  path: string,
  branchId: string,
  data: Record<string, unknown>
) {
  const uid = auth.currentUser?.uid ?? "unknown";
  return addDoc(collection(db, path), {
    ...data,
    branchId,
    archived: false,
    createdByUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocById(
  path: string,
  id: string,
  data: Record<string, unknown>
) {
  const uid = auth.currentUser?.uid ?? "unknown";
  return updateDoc(doc(db, path, id), {
    ...data,
    updatedByUid: uid,
    updatedAt: serverTimestamp(),
  });
}

/** "Delete" = archive, per spec. */
export async function archiveDoc(path: string, id: string) {
  return updateDoc(doc(db, path, id), {
    archived: true,
    updatedAt: serverTimestamp(),
  });
}

/** Permanently delete a document (hard delete). */
export async function deleteDocById(path: string, id: string) {
  return deleteDoc(doc(db, path, id));
}
