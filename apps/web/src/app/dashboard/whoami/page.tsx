"use client";

/**
 * Diagnostic page — shows exactly what the app resolves for the current user.
 * Visit /dashboard/whoami. If role is null/pending, assign a role (Users &
 * Roles) or run /setup. If role looks right but pages show permission-denied,
 * the rules aren't deployed: run `firebase deploy --only firestore:rules`.
 */

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { CenterSpinner } from "@/components/ui";

export default function WhoAmIPage() {
  const { user, role, branchId, roleResolved } = useAuth();
  const [docState, setDocState] = useState<string>("checking…");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setDocState(
          snap.exists()
            ? JSON.stringify(snap.data(), null, 2)
            : "NO /users doc exists for this uid"
        );
      } catch (e) {
        setDocState("Error reading /users doc: " + (e as Error).message);
      }
    })();
  }, [user]);

  if (!roleResolved) return <CenterSpinner label="Resolving…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-3xl font-semibold text-burgundy-700">
        Account diagnostic
      </h1>
      <div className="card space-y-4 p-6 font-mono text-sm">
        <Row label="Signed in" value={user ? "yes" : "no"} />
        <Row label="Email" value={user?.email ?? "—"} />
        <Row label="UID" value={user?.uid ?? "—"} />
        <Row
          label="Resolved role"
          value={role ?? "null (no role — assign one!)"}
          warn={!role || role === "pending"}
        />
        <Row label="Resolved branch" value={branchId ?? "null"} warn={!branchId} />
        <div>
          <p className="mb-1 font-sans text-xs uppercase tracking-wide text-ink-faint">
            users document
          </p>
          <pre className="overflow-auto rounded-lg bg-surface-muted p-3 text-xs text-ink">
            {docState}
          </pre>
        </div>
      </div>
      <div className="card mt-4 p-6 font-sans text-sm text-ink-soft">
        <p className="mb-2 font-semibold text-ink">How to read this:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            If <b>Resolved role</b> is null/pending, assign a role from Users &amp;
            Roles (as owner), or run <code>/setup</code> to become owner.
          </li>
          <li>
            If role looks correct here but other pages show permission-denied,
            deploy your rules: <code>firebase deploy --only firestore:rules</code>.
          </li>
          <li>After changing a role, sign out and back in.</li>
        </ul>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-2">
      <span className="font-sans text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <span className={warn ? "text-burgundy-600" : "text-ink"}>{value}</span>
    </div>
  );
}
