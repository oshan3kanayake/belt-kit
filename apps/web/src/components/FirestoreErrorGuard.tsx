"use client";

/**
 * Safety net for the known Firestore SDK bug:
 * "INTERNAL ASSERTION FAILED: Unexpected state" (IDs ca9 / b815).
 *
 * With experimentalForceLongPolling set in firebase.ts this shouldn't fire,
 * but if it ever does (it's an SDK-internal async throw, not our code), we
 * swallow that ONE specific error so it can't crash the app. Every other error
 * is left untouched. This is a widely-used mitigation for this exact bug.
 */

import { useEffect } from "react";

const SIGNATURE = "INTERNAL ASSERTION FAILED";

export function FirestoreErrorGuard() {
  useEffect(() => {
    function isFirestoreAssertion(msg: unknown): boolean {
      return typeof msg === "string" && msg.includes(SIGNATURE);
    }

    const onError = (e: ErrorEvent) => {
      if (isFirestoreAssertion(e.message) || isFirestoreAssertion(e.error?.message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (isFirestoreAssertion(reason?.message) || isFirestoreAssertion(reason)) {
        e.preventDefault();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
