"use client";

/**
 * Shared UI kit — Modal, Toast, Field, Select, Spinner, EmptyState, Badge,
 * ConfirmDialog. All styled in the burgundy/rose-gold luxury theme.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Inbox, CheckCircle2, AlertCircle } from "lucide-react";

// ---- Spinner ---------------------------------------------------------------
export function Spinner({ size = 24 }: { size?: number }) {
  return <Loader2 className="animate-spin text-rosegold-400" size={size} />;
}

export function CenterSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Spinner size={28} />
      {label && <p className="font-sans text-sm text-ink-soft">{label}</p>}
    </div>
  );
}

// ---- Empty state -----------------------------------------------------------
export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface-muted/50 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-rosegold-400 shadow-soft">
        <Icon size={26} />
      </div>
      <h3 className="font-serif text-xl font-semibold text-burgundy-700">
        {title}
      </h3>
      {hint && <p className="max-w-sm font-sans text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---- Badge -----------------------------------------------------------------
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "burgundy" | "gold" | "green" | "amber" | "blue";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-ink-soft",
    burgundy: "bg-burgundy-50 text-burgundy-600",
    gold: "bg-[#F7EFDD] text-[#8A6D2F]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sans text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// ---- Field (labeled input) -------------------------------------------------
export function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label-luxe">
        {label}
        {required && <span className="text-rosegold-500"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block font-sans text-xs text-ink-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

// ---- Modal -----------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const widths = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-burgundy-900/25 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`card relative z-10 my-auto w-full ${widths[size]} p-7 shadow-luxe-lg`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-semibold text-burgundy-700">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-muted hover:text-burgundy-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---- Confirm dialog --------------------------------------------------------
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="font-sans text-sm leading-relaxed text-ink-soft">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`btn-primary ${danger ? "bg-burgundy-700 hover:bg-burgundy-800" : ""}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---- Toast system ----------------------------------------------------------
type Toast = { id: number; message: string; kind: "success" | "error" };
const ToastCtx = createContext<{
  notify: (message: string, kind?: "success" | "error") => void;
}>({ notify: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback(
    (message: string, kind: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    },
    []
  );
  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 shadow-luxe"
            >
              {t.kind === "success" ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <AlertCircle size={18} className="text-burgundy-500" />
              )}
              <span className="font-sans text-sm text-ink">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---- Page header -----------------------------------------------------------
export function PageHeader({
  eyebrow,
  title,
  icon: Icon,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-700">
          <Icon size={19} />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            {eyebrow}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
        </div>
      </div>
      {action}
    </div>
  );
}
