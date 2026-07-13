"use client";

/**
 * One-time OWNER bootstrap (free tier, no Cloud Function).
 * ----------------------------------------------------------------------------
 * Sign in as the account you want to be the owner, visit /setup, and click the
 * button. It writes your /users doc as 'owner', creates the default branch, and
 * drops a meta/bootstrap marker so this can only ever run once. After that,
 * assign every other staff member from the Users & Roles screen.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

const BRANCH_ID = "main";

export default function SetupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function bootstrap() {
    if (!user) {
      setMsg("Please sign in first, then return to this page.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Refuse if bootstrap already happened.
      const marker = await getDoc(doc(db, "meta", "bootstrap"));
      if (marker.exists()) {
        setMsg(
          "Setup has already been completed. Assign roles from Users & Roles instead."
        );
        setBusy(false);
        return;
      }

      // 1) Branch (Sri Lanka defaults).
      await setDoc(
        doc(db, "branches", BRANCH_ID),
        {
          name: "Main Branch",
          currency: "LKR",
          taxRatePercent: 18,
          timezone: "Asia/Colombo",
          createdAt: serverTimestamp(),
          archived: false,
        },
        { merge: true }
      );

      // 2) This user becomes owner.
      await setDoc(
        doc(db, "users", user.uid),
        {
          branchId: BRANCH_ID,
          role: "owner",
          displayName: user.displayName ?? user.email ?? "Owner",
          email: user.email ?? "",
          active: true,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) Lock bootstrap so it can never run again.
      await setDoc(doc(db, "meta", "bootstrap"), {
        completedAt: serverTimestamp(),
        by: user.uid,
      });

      setDone(true);
      setMsg("You are now the owner. Redirecting to your dashboard…");
      setTimeout(() => router.push("/dashboard"), 1600);
    } catch (err: unknown) {
      const m = (err as { message?: string })?.message ?? "";
      setMsg(
        m.includes("permission")
          ? "Permission denied — an owner may already exist, or rules aren't deployed yet."
          : "Something went wrong. " + m
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="card w-full max-w-md p-8 shadow-luxe-lg">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-burgundy-deep text-white shadow-luxe">
          <ShieldCheck size={26} />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-burgundy-700">
          First-time setup
        </h1>
        <p className="mt-2 font-sans text-sm leading-relaxed text-ink-soft">
          This makes your current account the <strong>owner</strong> and creates
          your workshop branch. It can only be run once.
        </p>

        <div className="mt-5 rounded-xl bg-surface-muted px-4 py-3 font-sans text-sm text-ink-soft">
          {loading
            ? "Checking your session…"
            : user
            ? `Signed in as ${user.email}`
            : "You are not signed in. Log in first, then come back to /setup."}
        </div>

        {msg && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 font-sans text-sm ${
              done
                ? "bg-emerald-50 text-emerald-700"
                : "bg-burgundy-50 text-burgundy-600"
            }`}
          >
            {msg}
          </p>
        )}

        <button
          onClick={bootstrap}
          disabled={busy || !user || done}
          className="btn-primary mt-6 w-full"
        >
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Setting up…
            </>
          ) : (
            <>
              Make me the owner <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
