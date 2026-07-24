"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Receipt, FileText, TrendingUp, Wallet, TrendingDown, PiggyBank } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { Invoice, Customer, Part, Payment, InvoiceStatus } from "@/lib/models";
import { formatMoney, formatDate } from "@/lib/format";
import {
  PageHeader,
  TableSkeleton,
  EmptyState,
  Badge,
  DataTable,
  Column,
  FilterChips,
  SearchInput,
} from "@/components/ui";
import { AreaTrend, StatCard, VIZ } from "@/components/charts";

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
  const router = useRouter();
  const { data: invoices, loading, error } = useCollection<Invoice>("invoices");
  const { data: customers } = useCollection<Customer>("customers");
  const { data: parts } = useCollection<Part>("parts");
  const { data: payments } = useCollection<Payment>("payments");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = invoices;
    if (statusFilter === "unpaid")
      rows = rows.filter((i) => i.status !== "paid" && i.status !== "void");
    else if (statusFilter !== "all")
      rows = rows.filter((i) => i.status === statusFilter);
    if (q)
      rows = rows.filter((inv) =>
        customerName(inv.customerId).toLowerCase().includes(q)
      );
    return rows
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, statusFilter, customers]);

  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((s, i) => s + (i.totalMinor - i.amountPaidMinor), 0);
  const paymentInvoiceIds = useMemo(
    () => new Set(payments.map((payment) => payment.invoiceId)),
    [payments]
  );
  const collectedMTD = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + (payment.amountMinor || 0), 0) +
      invoices
        .filter((invoice) => !paymentInvoiceIds.has(invoice.id))
        .reduce((sum, invoice) => sum + (invoice.amountPaidMinor || 0), 0),
    [invoices, paymentInvoiceIds, payments]
  );
  const unpaidCount = invoices.filter(
    (i) => i.status !== "paid" && i.status !== "void"
  ).length;
  const paidCount = invoices.filter((i) => i.status === "paid").length;

  // Expenses = estimated cost of parts sold. Match each invoice line to a part
  // by name and use its cost price. Labor lines have no cost of goods.
  const { expenses, profit } = useMemo(() => {
    const costByName = new Map(
      parts.map((p) => [p.name.toLowerCase().trim(), p.costPriceMinor])
    );
    let exp = 0;
    invoices
      .filter((i) => i.status !== "void")
      .forEach((inv) => {
        (inv.lines || []).forEach((l) => {
          const cost =
            l.costPriceMinor ??
            costByName.get((l.description || "").toLowerCase().trim());
          if (cost !== undefined) exp += cost * (l.quantity || 1);
        });
      });
    return { expenses: exp, profit: collectedMTD - exp };
  }, [invoices, parts, collectedMTD]);

  const revenueSeries = useMemo(() => {
    const days: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: 0,
      });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    payments.forEach((payment) => {
      const t = payment.createdAt?.toDate?.();
      if (!t) return;
      const k = t.toISOString().slice(0, 10);
      if (idx.has(k)) days[idx.get(k)!].value += payment.amountMinor / 100;
    });
    // Invoices created before individual payment records existed still appear
    // once, using their invoice date as a documented legacy fallback.
    invoices.forEach((invoice) => {
      if (paymentInvoiceIds.has(invoice.id) || !invoice.amountPaidMinor) return;
      const t = invoice.createdAt?.toDate?.();
      if (!t) return;
      const k = t.toISOString().slice(0, 10);
      if (idx.has(k)) days[idx.get(k)!].value += invoice.amountPaidMinor / 100;
    });
    return days;
  }, [invoices, paymentInvoiceIds, payments]);

  const columns: Column<Invoice & { id: string }>[] = [
    {
      key: "customer",
      header: "Customer",
      sortValue: (inv) => customerName(inv.customerId).toLowerCase(),
      cell: (inv) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-burgundy-500">
            <Receipt size={16} />
          </div>
          <div>
            <p className="font-medium text-ink group-hover:text-burgundy-600">
              {customerName(inv.customerId)}
            </p>
            <p className="text-xs text-ink-faint">{inv.lines.length} lines</p>
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortValue: (inv) => inv.createdAt?.toMillis?.() ?? 0,
      hideBelow: "sm",
      cell: (inv) => (
        <span className="text-xs text-ink-faint">{formatDate(inv.createdAt)}</span>
      ),
    },
    {
      key: "due",
      header: "Due",
      align: "right",
      sortValue: (inv) => inv.totalMinor - inv.amountPaidMinor,
      hideBelow: "md",
      cell: (inv) => {
        const due = inv.totalMinor - inv.amountPaidMinor;
        return due > 0 ? (
          <span className="text-burgundy-500">{formatMoney(due)}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        );
      },
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (inv) => inv.totalMinor,
      cell: (inv) => (
        <span className="font-semibold text-ink">{formatMoney(inv.totalMinor)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      sortValue: (inv) => inv.status,
      cell: (inv) => (
        <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Finance" title="Billing" icon={Receipt} />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">Revenue collected</h2>
            <p className="text-xs text-ink-faint">Last 14 days</p>
          </div>
          <AreaTrend
            data={revenueSeries}
            color={VIZ.indigo}
            height={200}
            formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard label="Invoices" value={String(invoices.length)} icon={<FileText size={16} />} accent={VIZ.slate} />
          <StatCard label="Outstanding" value={formatMoney(outstanding)} icon={<TrendingUp size={16} />} accent={VIZ.amber} />
          <StatCard label="Collected" value={formatMoney(collectedMTD)} icon={<Wallet size={16} />} accent={VIZ.emerald} />
        </div>
      </div>

      {/* Profit summary: revenue − parts cost = profit */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue (collected)"
          value={formatMoney(collectedMTD)}
          hint="All payments received"
          icon={<Wallet size={16} />}
          accent={VIZ.emerald}
        />
        <StatCard
          label="Expenses (parts cost)"
          value={formatMoney(expenses)}
          hint="Cost of parts sold"
          icon={<TrendingDown size={16} />}
          accent={VIZ.rose}
        />
        <StatCard
          label="Profit"
          value={formatMoney(profit)}
          hint={profit >= 0 ? "Revenue − expenses" : "Running at a loss"}
          icon={<PiggyBank size={16} />}
          accent={profit >= 0 ? VIZ.indigo : VIZ.amber}
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All", count: invoices.length },
            { value: "unpaid", label: "Outstanding", count: unpaidCount },
            { value: "paid", label: "Paid", count: paidCount },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by customer…"
          className="w-full sm:max-w-xs"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton cols={5} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          onRowClick={(inv) => router.push(`/dashboard/billing/${inv.id}`)}
          emptyState={
            <EmptyState
              icon={Receipt}
              title={search || statusFilter !== "all" ? "No matches" : "No invoices yet"}
              hint={
                search || statusFilter !== "all"
                  ? "Try another search or filter."
                  : "Invoices appear here once you generate them from a job card."
              }
            />
          }
        />
      )}
    </div>
  );
}
