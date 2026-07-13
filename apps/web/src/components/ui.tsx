"use client";

/**
 * Shared UI kit — Modal, Toast, Field, Select, Spinner, EmptyState, Badge,
 * ConfirmDialog. All styled in the burgundy/rose-gold luxury theme.
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Loader2,
  Inbox,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
} from "lucide-react";

// ---- Spinner ---------------------------------------------------------------
export function Spinner({ size = 24 }: { size?: number }) {
  return <Loader2 className="animate-spin text-burgundy-600" size={size} />;
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface-muted/40 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy-50 text-burgundy-600">
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-semibold text-ink">
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
    neutral: "bg-gray-100 text-gray-700",
    burgundy: "bg-burgundy-50 text-burgundy-700",
    gold: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-orange-50 text-orange-700",
    blue: "bg-sky-50 text-sky-700",
  };
  const dots: Record<string, string> = {
    neutral: "bg-gray-400",
    burgundy: "bg-burgundy-500",
    gold: "bg-amber-500",
    green: "bg-emerald-500",
    amber: "bg-orange-500",
    blue: "bg-sky-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-medium ${tones[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
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
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`card relative z-10 my-auto w-full ${widths[size]} p-7 shadow-luxe-lg`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
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
          className={`btn-primary ${danger ? "!bg-rose-600 hover:!bg-rose-700" : ""}`}
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
              className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 shadow-luxe"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${
                  t.kind === "success" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              >
                {t.kind === "success" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertCircle size={15} />
                )}
              </span>
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
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

// ---- Skeleton loaders ------------------------------------------------------
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-surface-muted via-line/60 to-surface-muted bg-[length:200%_100%] ${className}`}
      style={{ animation: "shimmer 1.6s linear infinite" }}
    />
  );
}

/** A table-shaped skeleton shown while data loads. */
export function TableSkeleton({
  cols = 5,
  rows = 6,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 border-b border-line bg-surface-muted/60 px-5 py-3.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line/70">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-3.5 flex-1 ${c === 0 ? "max-w-[40%]" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Search input ----------------------------------------------------------
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-luxe pl-10"
      />
    </div>
  );
}

// ---- Filter chips ----------------------------------------------------------
export type FilterOption = {
  value: string;
  label: string;
  count?: number;
  tone?: "burgundy" | "gold" | "green" | "amber" | "blue" | "neutral";
};

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-colors duration-150 ${
              active
                ? "border-burgundy-600 bg-burgundy-600 text-white"
                : "border-line bg-white text-ink-soft hover:border-burgundy-300 hover:text-burgundy-600"
            }`}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                  active ? "bg-white/25 text-white" : "bg-surface-muted text-ink-faint"
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- DataTable -------------------------------------------------------------
export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Value used for sorting; return string or number. Omit to disable sort. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  /** Optional fixed width utility class, e.g. "w-32". */
  width?: string;
  /** Hide on small screens. */
  hideBelow?: "sm" | "md" | "lg";
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * A professional, reusable data table: sortable columns, sticky header,
 * hover row states, optional row-click, and an inline empty state.
 * Pure presentation — the parent supplies rows and columns.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  rowActions,
  initialSort,
  emptyState,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  /** Right-aligned per-row action buttons (won't trigger row click). */
  rowActions?: (row: T) => ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyState?: ReactNode;
}) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key
        ? s.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" }
    );
  }

  const hideCls = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };
  const alignCls = { left: "text-left", right: "text-right", center: "text-center" };

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted/70 backdrop-blur">
            <tr className="border-b border-line">
              {columns.map((c) => {
                const sortable = !!c.sortValue;
                const activeSort = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint ${
                      c.width ?? ""
                    } ${c.hideBelow ? hideCls[c.hideBelow] : ""} ${
                      alignCls[c.align ?? "left"]
                    }`}
                  >
                    {sortable ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-burgundy-600 ${
                          c.align === "right" ? "flex-row-reverse" : ""
                        } ${activeSort ? "text-burgundy-600" : ""}`}
                      >
                        {c.header}
                        {activeSort ? (
                          sort!.dir === "asc" ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )
                        ) : (
                          <ChevronsUpDown size={13} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/80">
            <AnimatePresence initial={false}>
              {sorted.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.25) }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group bg-white transition-colors duration-150 ${
                    onRowClick
                      ? "cursor-pointer hover:bg-burgundy-50/40"
                      : "hover:bg-surface-muted/40"
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-5 py-3.5 ${c.hideBelow ? hideCls[c.hideBelow] : ""} ${
                        alignCls[c.align ?? "left"]
                      }`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td
                      className="px-5 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        {rowActions(row)}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
