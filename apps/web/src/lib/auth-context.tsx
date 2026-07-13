"use client";

/**
 * Auth context — tracks the signed-in user, their role, and their branch.
 * ----------------------------------------------------------------------------
 * Role + branchId are read from the user's /users/{uid} Firestore document
 * (free-tier source of truth); a custom claim wins if present.
 *
 * We read the /users doc with a ONE-TIME getDoc (not a live onSnapshot). A
 * persistent listener here caused a known Firestore SDK crash during Next.js
 * hot-reload ("INTERNAL ASSERTION FAILED: Unexpected state"). Role changes are
 * picked up on next sign-in or by calling refreshRole().
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Role =
  | "owner"
  | "manager"
  | "advisor"
  | "technician"
  | "accountant"
  | "customer"
  | "pending";

interface AuthState {
  user: User | null;
  role: Role | null;
  branchId: string | null;
  loading: boolean;
  roleResolved: boolean;
  logout: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  branchId: null,
  loading: true,
  roleResolved: false,
  logout: async () => {},
  refreshRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleResolved, setRoleResolved] = useState(false);

  // Resolve role/branch for a given user via claims then a one-time doc read.
  const resolveRole = useCallback(async (u: User) => {
    setRoleResolved(false);
    try {
      const token = await u.getIdTokenResult();
      const claimRole = (token.claims.role as Role) ?? null;
      const claimBranch = (token.claims.branchId as string) ?? null;

      let docRole: Role | null = null;
      let docBranch: string | null = null;
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          docRole = (data?.role as Role) ?? null;
          docBranch = (data?.branchId as string) ?? null;
        }
      } catch {
        /* fall back to claims */
      }

      setRole(claimRole ?? docRole);
      setBranchId(claimBranch ?? docBranch);
    } finally {
      setRoleResolved(true);
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setRole(null);
        setBranchId(null);
        setRoleResolved(true);
        return;
      }
      await resolveRole(u);
    });
    return () => unsubAuth();
  }, [resolveRole]);

  const refreshRole = useCallback(async () => {
    if (auth.currentUser) await resolveRole(auth.currentUser);
  }, [resolveRole]);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, role, branchId, loading, roleResolved, logout, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
