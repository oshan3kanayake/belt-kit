"use client";

/**
 * Virtual card-payment terminal (MOCK — no real hardware/gateway).
 * ----------------------------------------------------------------------------
 * Simulates a contactless card machine so you can test card payments for free.
 * Flow: shows a terminal → user taps the card graphic → "Processing…" →
 * "Approved" → calls onApproved() which records the payment. Fully offline.
 *
 * This is clearly a simulation and stores NO card data (there is none) — it just
 * drives the payment UX. Swap for Stripe Terminal / a real gateway later.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, CheckCircle2, Loader2, Nfc } from "lucide-react";
import { formatMoney } from "@/lib/format";

type Phase = "idle" | "processing" | "approved";

export function CardTerminal({
  amountMinor,
  currency,
  onApproved,
  onCancel,
}: {
  amountMinor: number;
  currency: string;
  onApproved: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  function tap() {
    if (phase !== "idle") return;
    setPhase("processing");
    // Simulated authorization delay.
    setTimeout(() => {
      setPhase("approved");
      setTimeout(() => onApproved(), 1100);
    }, 1600);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 font-sans text-xs uppercase tracking-[0.2em] text-ink-faint">
        Virtual card terminal · demo
      </div>
      <div className="mb-5 font-serif text-3xl font-semibold text-burgundy-700">
        {formatMoney(amountMinor, currency)}
      </div>

      {/* Terminal face */}
      <div className="relative flex h-56 w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl bg-burgundy-deep shadow-luxe-lg">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.button
              key="idle"
              onClick={tap}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-white"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                className="flex h-20 w-28 items-center justify-center rounded-xl bg-white/10 backdrop-blur"
              >
                <CreditCard size={40} className="text-rosegold-200" />
              </motion.div>
              <span className="flex items-center gap-2 font-sans text-sm">
                <Nfc size={16} /> Tap card to pay
              </span>
            </motion.button>
          )}

          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-white"
            >
              <Loader2 size={44} className="animate-spin text-rosegold-200" />
              <span className="font-sans text-sm">Processing…</span>
              <span className="font-sans text-xs text-white/60">
                Contacting bank
              </span>
            </motion.div>
          )}

          {phase === "approved" && (
            <motion.div
              key="approved"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 text-white"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <CheckCircle2 size={52} className="text-emerald-300" />
              </motion.div>
              <span className="font-sans text-base font-medium">Approved</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "idle" && (
        <button
          onClick={onCancel}
          className="btn-ghost mt-5 px-6 py-2 text-sm"
        >
          Cancel
        </button>
      )}
      {phase !== "idle" && (
        <p className="mt-5 font-sans text-xs text-ink-faint">
          Please don&apos;t close this window…
        </p>
      )}
    </div>
  );
}
