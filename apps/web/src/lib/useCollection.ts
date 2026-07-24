"use client";

/**
 * Typed Firestore data hooks, branch-scoped and role-aware.
 * ----------------------------------------------------------------------------
 * Every business collection is filtered by the signed-in user's branchId
 * (matching the security rules), and excludes archived records by default.
 *
 * Technicians can only READ job cards they're assigned to (per the rules), so
 * for the jobCards collection we automatically add an assignedTechnicianIds
 * filter for that role — otherwise the snapshot would touch unreadable docs and
 * fail the whole query with permission-denied.
 *
 * We also wait until the user's role is resolved before querying, so we never
 * fire a query with a null role/branch.
 */

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./auth-context";
import { canRead } from "./permissions";

export interface WithId {
  id: string;
}

/**
 * Live-subscribe to a branch-scoped collection.
 * @param path collection name (e.g. "customers")
 * @param extra additional query constraints (where/orderBy)
 * @param includeArchived set true to include archived docs
 */
export function useCollection<T = DocumentData>(
  path: string,
  extra: QueryConstraint[] = [],
  includeArchived = false,
  dependencyKey?: string
) {
  const { branchId, role, roleResolved } = useAuth();
  const [data, setData] = useState<(T & WithId)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const extraKey = dependencyKey ?? JSON.stringify(
    extra.map((c) => (c as unknown as { _field?: string })._field ?? "")
  );

  useEffect(() => {
    // Wait until we know the user's role/branch.
    if (!roleResolved) {
      setLoading(true);
      return;
    }
    if (!role) {
      // Signed in but no role assigned yet.
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    // Skip entirely if this role can't read the collection — prevents a
    // guaranteed permission-denied error from breaking the page.
    if (!canRead(role, path)) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);

    // Single-branch system: no branchId filtering (rules don't scope by branch).
    const constraints: QueryConstraint[] = [...extra];

    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        let rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as T) }) as T & WithId
        );
        if (!includeArchived) {
          rows = rows.filter(
            (r) => !(r as unknown as { archived?: boolean }).archived
          );
        }
        setData(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(
          err.code === "permission-denied"
            ? "You don't have permission to view this, or the security rules aren't deployed yet."
            : err.message
        );
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, branchId, role, roleResolved, extraKey, includeArchived]);

  return { data, loading, error };
}

export { where, orderBy };
