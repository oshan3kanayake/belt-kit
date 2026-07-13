"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Receipt, Search, ChevronRight } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { Invoice, Customer, InvoiceStatus } from "@/lib/models";
import { formatMoney, formatDate } from "@/lib/format";
import { PageHeader, CenterSpinner, EmptyState, Badge } from "@/components/ui";

const STATUS_TONE: Record<
  InvoiceStatus,
  "neutral" | "blue" | "amber" | "green" | "burgundy"
> = {
  draft: "neutral",
  issued: "blue",
  part_paid: "amber",
  paid: "green",
  void: "burgundy",
};
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  part_paid: "Part Paid",
  paid: "Paid",
  void: "Void",
};

export default function BillingPage() {
  const { data: invoices, loading, error } = useCollection<Invoice>("invoices");
  const { data: customers } = useCollection<Customer>("customers");
  const [search, setSearch] = useState("");

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = q
      ? invoices.filter((inv) =>
          customerName(inv.customerId).toLowerCase().includes(q)
        )
      : invoices;
    return rows
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, customers]);

  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((s, i) => s + (i.totalMinor - i.amountPaidMinor), 0);
  const collectedMTD = invoices.reduce((s, i) => s + i.amountPaidMinor, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Finance" title="Billing" icon={Receipt} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="font-sans text-xs uppercase tracking-wide text-ink-faint">
            Invoices
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">
            {invoices.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="font-sans text-xs uppercase tracking-wide text-ink-faint">
            Outstanding
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-burgundy-600">
            {formatMoney(outstanding)}
          </p>
        </div>
        <div className="card p-5">
          <p className="font-sans text-xs uppercase tracking-wide text-ink-faint">
            Collected
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-emerald-600">
            {formatMoney(collectedMTD)}
          </p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer…"
          className="input-luxe pl-11"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        <CenterSpinner label="Loading invoices…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={search ? "No matches" : "No invoices yet"}
          hint={
            search
              ? "Try another search."
              : "Invoices appear here once you generate them from a job card."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv, i) => {
            const due = inv.totalMinor - inv.amountPaidMinor;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link
                  href={`/dashboard/billing/${inv.id}`}
                  className="card flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-luxe"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-burgundy-500">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <p className="font-sans font-medium text-ink">
                        {customerName(inv.customerId)}
                      </p>
                      <p className="font-sans text-xs text-ink-faint">
                        {formatDate(inv.createdAt)} · {inv.lines.length} lines
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-sans font-semibold text-ink">
                        {formatMoney(inv.totalMinor)}
                      </p>
                      {due > 0 && (
                        <p className="font-sans text-xs text-burgundy-500">
                          {formatMoney(due)} due
                        </p>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[inv.status]}>
                      {STATUS_LABEL[inv.status]}
                    </Badge>
                    <ChevronRight size={18} className="text-ink-faint" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
