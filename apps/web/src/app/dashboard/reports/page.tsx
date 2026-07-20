"use client";

import { useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  FileDown,
  Package,
  Receipt,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/useCollection";
import { Customer, Invoice, JobCard, Part, Payment, Vehicle } from "@/lib/models";
import { canViewReports } from "@/lib/permissions";
import { downloadCsv, reportCsvFilename, reportPdfFilename } from "@/lib/csv-export";
import { downloadReportPdf } from "@/lib/pdf-export";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, EmptyState, PageHeader, TableSkeleton } from "@/components/ui";

type ReportKey = "revenue" | "profit" | "jobs" | "inventory";
type RecordWithId<T> = T & { id: string };

type LooseInvoiceLine = Invoice["lines"][number] & {
  kind?: unknown;
  partId?: unknown;
  costPriceMinor?: unknown;
};

type RevenueRow = {
  id: string;
  date: Date | null;
  invoice: string;
  customer: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
  status: string;
};

type ProfitRow = {
  id: string;
  date: Date | null;
  invoice: string;
  customer: string;
  currency: string;
  salesMinor: number;
  partsCostMinor: number;
  profitMinor: number;
  costBasis: string;
};

type CompletedJobRow = {
  id: string;
  date: Date | null;
  job: string;
  customer: string;
  vehicle: string;
  plateNumber: string;
  complaint: string;
  invoice: string;
  totalMinor: number;
};

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  lowStock: boolean;
  binLocation: string;
  unitCostMinor: number;
  sellPriceMinor: number;
  costValueMinor: number;
  retailValueMinor: number;
};

const PREVIEW_LIMIT = 12;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function minorAmount(value: unknown): number {
  return Math.round(finiteNumber(value));
}

function optionalMinorAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function dateFromUnknown(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string" || typeof value === "number") {
    const numeric = typeof value === "number" && value < 10_000_000_000
      ? value * 1000
      : value;
    const date = new Date(numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: unknown; seconds?: unknown };
    if (typeof timestamp.toDate === "function") {
      try {
        const date = (timestamp.toDate as () => Date)();
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
      } catch {
        // Continue to the legacy Firestore `seconds` representation below.
      }
    }
    if (typeof timestamp.seconds === "number") {
      const date = new Date(timestamp.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function parseDateInput(value: string, endOfDay = false): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
}

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinRange(
  date: Date | null,
  from: Date | null,
  to: Date | null
): boolean {
  // Undated legacy rows remain visible in all-time reports, but cannot be
  // confidently included once the user asks for a bounded period.
  if (!date) return !from && !to;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function csvDate(date: Date | null): string {
  return date ? localDateInput(date) : "Date unavailable";
}

function csvMoney(minor: number): number {
  return Number((minor / 100).toFixed(2));
}

function shortReference(prefix: string, id?: string | null): string {
  return id ? `${prefix}-${id.slice(0, 8).toUpperCase()}` : "—";
}

function displayStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function dateSortDesc(a: Date | null, b: Date | null): number {
  return (b?.getTime() ?? 0) - (a?.getTime() ?? 0);
}

function invoicePartsCost(
  invoice: RecordWithId<Invoice>,
  partById: Map<string, RecordWithId<Part>>,
  partByName: Map<string, RecordWithId<Part>>
): { amountMinor: number; basis: string } {
  let amountMinor = 0;
  let savedLines = 0;
  let estimatedLines = 0;
  let unmatchedPartLines = 0;

  (invoice.lines ?? []).forEach((rawLine) => {
    const line = rawLine as LooseInvoiceLine;
    const quantity = Math.max(0, finiteNumber(line.quantity, 1));
    const savedCost = optionalMinorAmount(line.costPriceMinor);

    if (savedCost !== null) {
      amountMinor += savedCost * quantity;
      savedLines += 1;
      return;
    }

    if (line.kind === "labor") return;

    const partId = typeof line.partId === "string" ? line.partId : "";
    const matchedPart =
      (partId ? partById.get(partId) : undefined) ??
      partByName.get(normaliseName(line.description));

    if (matchedPart) {
      amountMinor += minorAmount(matchedPart.costPriceMinor) * quantity;
      estimatedLines += 1;
    } else if (line.kind === "part") {
      unmatchedPartLines += 1;
    }
  });

  let basis = "No matched parts";
  if (savedLines && estimatedLines) basis = "Saved costs + catalogue estimate";
  else if (savedLines) basis = "Saved invoice costs";
  else if (estimatedLines) basis = "Current catalogue estimate";
  if (unmatchedPartLines) basis += " (some part costs unavailable)";

  return { amountMinor: Math.round(amountMinor), basis };
}

function ReportCard({
  active,
  icon: Icon,
  title,
  description,
  value,
  hint,
  onSelect,
  onDownload,
  onDownloadPdf,
  downloadDisabled,
}: {
  active: boolean;
  icon: ElementType;
  title: string;
  description: string;
  value: string;
  hint: string;
  onSelect: () => void;
  onDownload: () => void;
  onDownloadPdf: () => void;
  downloadDisabled?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-soft transition-all ${
        active ? "border-burgundy-300 ring-4 ring-burgundy-50" : "border-line"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-50 text-burgundy-600">
            <Icon size={19} />
          </span>
          {active && <Badge tone="blue">Viewing</Badge>}
        </div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 min-h-10 text-xs leading-relaxed text-ink-faint">{description}</p>
        <p className="mt-4 text-xl font-semibold tracking-tight text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloadDisabled}
          className="btn-ghost w-full !px-2 !py-2 text-xs"
        >
          <Download size={14} /> CSV
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={downloadDisabled}
          className="btn-ghost w-full !px-2 !py-2 text-xs"
        >
          <FileDown size={14} /> PDF
        </button>
      </div>
    </div>
  );
}

function TableFrame({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  return (
    <>
      <div className="overflow-x-auto">{children}</div>
      {count > PREVIEW_LIMIT && (
        <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">
          Showing the first {PREVIEW_LIMIT} of {count} rows. Downloads include every row.
        </p>
      )}
    </>
  );
}

function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No revenue records in this period"
        hint="Clear or widen the date range to include more recorded payments."
      />
    );
  }
  return (
    <TableFrame count={rows.length}>
      <table className="table-luxe min-w-[820px]">
        <thead><tr><th>Last payment</th><th>Invoice</th><th>Customer</th><th className="text-right">Invoice total</th><th className="text-right">Collected in period</th><th className="text-right">Current due</th><th>Status</th></tr></thead>
        <tbody>
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id}>
              <td className="text-xs text-ink-faint">{formatDate(row.date)}</td>
              <td className="font-medium text-ink">{row.invoice}</td>
              <td className="text-ink-soft">{row.customer}</td>
              <td className="text-right font-medium text-ink">{formatMoney(row.totalMinor, row.currency)}</td>
              <td className="text-right text-emerald-700">{formatMoney(row.paidMinor, row.currency)}</td>
              <td className="text-right text-ink-soft">{formatMoney(row.dueMinor, row.currency)}</td>
              <td><Badge tone={row.status === "paid" ? "green" : row.status === "part_paid" ? "amber" : "blue"}>{displayStatus(row.status)}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function ProfitTable({ rows }: { rows: ProfitRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No profit records in this period"
        hint="Profit appears when non-void invoices fall inside the selected dates."
      />
    );
  }
  return (
    <TableFrame count={rows.length}>
      <table className="table-luxe min-w-[820px]">
        <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th className="text-right">Sales excl. tax</th><th className="text-right">Parts cost</th><th className="text-right">Gross profit</th><th>Cost basis</th></tr></thead>
        <tbody>
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id}>
              <td className="text-xs text-ink-faint">{formatDate(row.date)}</td>
              <td className="font-medium text-ink">{row.invoice}</td>
              <td className="text-ink-soft">{row.customer}</td>
              <td className="text-right text-ink">{formatMoney(row.salesMinor, row.currency)}</td>
              <td className="text-right text-ink-soft">{formatMoney(row.partsCostMinor, row.currency)}</td>
              <td className={`text-right font-semibold ${row.profitMinor >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{formatMoney(row.profitMinor, row.currency)}</td>
              <td className="max-w-56 text-xs text-ink-faint">{row.costBasis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function CompletedJobsTable({ rows }: { rows: CompletedJobRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No completed jobs in this period"
        hint="Jobs are included after their status is changed to Delivered."
      />
    );
  }
  return (
    <TableFrame count={rows.length}>
      <table className="table-luxe min-w-[820px]">
        <thead><tr><th>Completed</th><th>Job</th><th>Customer</th><th>Vehicle</th><th>Complaint</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id}>
              <td className="text-xs text-ink-faint">{formatDate(row.date)}</td>
              <td className="font-medium text-ink">{row.job}</td>
              <td className="text-ink-soft">{row.customer}</td>
              <td><p className="font-medium text-ink">{row.plateNumber}</p><p className="text-xs text-ink-faint">{row.vehicle}</p></td>
              <td className="max-w-64 truncate text-ink-soft" title={row.complaint}>{row.complaint}</td>
              <td className="text-right font-medium text-ink">{formatMoney(row.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Package}
        title="No inventory records"
        hint="Add parts in Inventory before downloading this snapshot."
      />
    );
  }
  return (
    <TableFrame count={rows.length}>
      <table className="table-luxe min-w-[820px]">
        <thead><tr><th>SKU</th><th>Part</th><th className="text-right">On hand</th><th className="text-right">Reorder at</th><th>Status</th><th className="text-right">Unit cost</th><th className="text-right">Retail value</th></tr></thead>
        <tbody>
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id}>
              <td className="font-mono text-xs text-ink-faint">{row.sku || "—"}</td>
              <td><p className="font-medium text-ink">{row.name}</p><p className="text-xs text-ink-faint">{row.binLocation || "No bin set"}</p></td>
              <td className="text-right font-semibold text-ink">{row.quantity}</td>
              <td className="text-right text-ink-soft">{row.reorderLevel}</td>
              <td><Badge tone={row.lowStock ? "amber" : "green"}>{row.lowStock ? "Low stock" : "In stock"}</Badge></td>
              <td className="text-right text-ink-soft">{formatMoney(row.unitCostMinor)}</td>
              <td className="text-right font-medium text-ink">{formatMoney(row.retailValueMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

export default function ReportsPage() {
  const { role } = useAuth();
  const { data: invoices, loading: invoicesLoading, error: invoicesError } =
    useCollection<Invoice>("invoices", [], true);
  const { data: payments, loading: paymentsLoading, error: paymentsError } =
    useCollection<Payment>("payments", [], true);
  const { data: customers, loading: customersLoading, error: customersError } =
    useCollection<Customer>("customers", [], true);
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } =
    useCollection<Vehicle>("vehicles", [], true);
  const { data: jobs, loading: jobsLoading, error: jobsError } =
    useCollection<JobCard>("jobCards", [], true);
  const { data: parts, loading: partsLoading, error: partsError } =
    useCollection<Part>("parts", [], true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeReport, setActiveReport] = useState<ReportKey>("revenue");

  const from = useMemo(() => parseDateInput(fromDate), [fromDate]);
  const to = useMemo(() => parseDateInput(toDate, true), [toDate]);
  const invalidRange = Boolean(from && to && from > to);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles]
  );
  const partById = useMemo(
    () => new Map(parts.map((part) => [part.id, part])),
    [parts]
  );
  const partByName = useMemo(
    () => new Map(parts.map((part) => [normaliseName(part.name), part])),
    [parts]
  );
  const invoiceIdsWithPayments = useMemo(
    () => new Set(payments.map((payment) => payment.invoiceId)),
    [payments]
  );
  const paidAllTimeByInvoice = useMemo(() => {
    const totals = new Map<string, number>();
    payments.forEach((payment) => {
      totals.set(
        payment.invoiceId,
        (totals.get(payment.invoiceId) ?? 0) +
          Math.max(0, minorAmount(payment.amountMinor))
      );
    });
    return totals;
  }, [payments]);
  const paymentsByInvoiceInPeriod = useMemo(() => {
    const totals = new Map<string, { amountMinor: number; latestDate: Date | null }>();
    if (invalidRange) return totals;
    payments.forEach((payment) => {
      const date = dateFromUnknown(payment.createdAt);
      if (!isWithinRange(date, from, to)) return;
      const current = totals.get(payment.invoiceId);
      totals.set(payment.invoiceId, {
        amountMinor:
          (current?.amountMinor ?? 0) + Math.max(0, minorAmount(payment.amountMinor)),
        latestDate:
          !current?.latestDate || (date && date > current.latestDate)
            ? date
            : current.latestDate,
      });
    });
    return totals;
  }, [from, invalidRange, payments, to]);

  const revenueRows = useMemo<RevenueRow[]>(() => {
    if (invalidRange) return [];
    return invoices
      .filter((invoice) => invoice.status !== "void")
      .map((invoice) => {
        const paymentSummary = paymentsByInvoiceInPeriod.get(invoice.id);
        const invoiceDate = dateFromUnknown(invoice.createdAt);
        const totalMinor = Math.max(0, minorAmount(invoice.totalMinor));
        const savedPaid = optionalMinorAmount(
          (invoice as Invoice & { amountPaidMinor?: unknown }).amountPaidMinor
        );
        // Old invoices may have an amountPaidMinor but no payment documents.
        // Use their invoice date only as an explicit legacy fallback.
        const legacyPaid =
          !invoiceIdsWithPayments.has(invoice.id) &&
          isWithinRange(invoiceDate, from, to)
            ? Math.max(0, savedPaid ?? 0)
            : 0;
        const paidMinor = paymentSummary?.amountMinor ?? legacyPaid;
        const paidAllTime = Math.max(
          0,
          savedPaid ?? paidAllTimeByInvoice.get(invoice.id) ?? 0
        );
        return {
          id: invoice.id,
          date: paymentSummary?.latestDate ?? (legacyPaid > 0 ? invoiceDate : null),
          invoice: shortReference("INV", invoice.id),
          customer: customerById.get(invoice.customerId)?.displayName ?? "Unknown customer",
          currency: invoice.currency || "LKR",
          totalMinor,
          paidMinor,
          dueMinor: Math.max(0, totalMinor - paidAllTime),
          status: invoice.status || "issued",
        };
      })
      .filter((row) => row.paidMinor > 0)
      .sort((a, b) => dateSortDesc(a.date, b.date));
  }, [
    customerById,
    from,
    invalidRange,
    invoiceIdsWithPayments,
    invoices,
    paidAllTimeByInvoice,
    paymentsByInvoiceInPeriod,
    to,
  ]);

  const profitRows = useMemo<ProfitRow[]>(() => {
    if (invalidRange) return [];
    return invoices
      .filter((invoice) => invoice.status !== "void")
      .map((invoice) => {
        const date = dateFromUnknown(invoice.createdAt);
        const totalMinor = optionalMinorAmount(invoice.totalMinor);
        const taxMinor = minorAmount(invoice.taxMinor);
        const salesMinor = Math.max(
          0,
          totalMinor === null
            ? minorAmount(invoice.subtotalMinor)
            : totalMinor - taxMinor
        );
        const cost = invoicePartsCost(invoice, partById, partByName);
        return {
          id: invoice.id,
          date,
          invoice: shortReference("INV", invoice.id),
          customer: customerById.get(invoice.customerId)?.displayName ?? "Unknown customer",
          currency: invoice.currency || "LKR",
          salesMinor,
          partsCostMinor: cost.amountMinor,
          profitMinor: salesMinor - cost.amountMinor,
          costBasis: cost.basis,
        };
      })
      .filter((row) => isWithinRange(row.date, from, to))
      .sort((a, b) => dateSortDesc(a.date, b.date));
  }, [customerById, from, invalidRange, invoices, partById, partByName, to]);

  const completedJobRows = useMemo<CompletedJobRow[]>(() => {
    if (invalidRange) return [];
    return jobs
      .filter((job) => job.status === "delivered")
      .map((job) => {
        const legacyJob = job as JobCard & { actualEndDate?: unknown };
        const date =
          dateFromUnknown(legacyJob.actualEndDate) ?? dateFromUnknown(job.createdAt);
        const vehicle = vehicleById.get(job.vehicleId);
        const vehicleName = vehicle
          ? [vehicle.make, vehicle.model].filter(Boolean).join(" ")
          : "Unknown vehicle";
        return {
          id: job.id,
          date,
          job: shortReference("JOB", job.id),
          customer: customerById.get(job.customerId)?.displayName ?? "Unknown customer",
          vehicle: vehicleName,
          plateNumber: vehicle?.plateNumber ?? "—",
          complaint: job.complaint || "—",
          invoice: shortReference("INV", job.invoiceId),
          totalMinor: Math.max(0, minorAmount(job.totalMinor)),
        };
      })
      .filter((row) => isWithinRange(row.date, from, to))
      .sort((a, b) => dateSortDesc(a.date, b.date));
  }, [customerById, from, invalidRange, jobs, to, vehicleById]);

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    return parts
      .filter((part) => !part.archived)
      .map((part) => {
        const quantity = finiteNumber(part.quantityOnHand);
        const reorderLevel = finiteNumber(part.reorderThreshold);
        const unitCostMinor = minorAmount(part.costPriceMinor);
        const sellPriceMinor = minorAmount(part.sellPriceMinor);
        return {
          id: part.id,
          sku: part.sku || "",
          name: part.name || "Unnamed part",
          quantity,
          reorderLevel,
          lowStock: Boolean(part.lowStock) || quantity <= reorderLevel,
          binLocation: part.binLocation || "",
          unitCostMinor,
          sellPriceMinor,
          costValueMinor: Math.round(unitCostMinor * quantity),
          retailValueMinor: Math.round(sellPriceMinor * quantity),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [parts]);

  const totalInvoiced = revenueRows.reduce((sum, row) => sum + row.totalMinor, 0);
  const totalCollected = revenueRows.reduce((sum, row) => sum + row.paidMinor, 0);
  const totalProfit = profitRows.reduce((sum, row) => sum + row.profitMinor, 0);
  const inventoryRetailValue = inventoryRows.reduce(
    (sum, row) => sum + row.retailValueMinor,
    0
  );
  const lowStockCount = inventoryRows.filter((row) => row.lowStock).length;
  const primaryCurrency = revenueRows[0]?.currency ?? invoices[0]?.currency ?? "LKR";

  const periodLabel = from && to
    ? `${formatDate(from)} – ${formatDate(to)}`
    : from
      ? `From ${formatDate(from)}`
      : to
        ? `Through ${formatDate(to)}`
        : "All recorded dates";

  const setLast30Days = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 29);
    setFromDate(localDateInput(start));
    setToDate(localDateInput(end));
  };

  const setThisMonth = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    setFromDate(localDateInput(start));
    setToDate(localDateInput(end));
  };

  const exportRevenue = () =>
    downloadCsv<RevenueRow>(
      reportCsvFilename("revenue", fromDate, toDate),
      [
        { header: "Last payment date in period", value: (row) => csvDate(row.date) },
        { header: "Invoice", value: (row) => row.invoice },
        { header: "Customer", value: (row) => row.customer },
        { header: "Currency", value: (row) => row.currency },
        { header: "Total", value: (row) => csvMoney(row.totalMinor) },
        { header: "Collected in period", value: (row) => csvMoney(row.paidMinor) },
        { header: "Due", value: (row) => csvMoney(row.dueMinor) },
        { header: "Status", value: (row) => displayStatus(row.status) },
      ],
      revenueRows
    );

  const exportRevenuePdf = () =>
    downloadReportPdf<RevenueRow>({
      filename: reportPdfFilename("revenue", fromDate, toDate),
      title: "Revenue report",
      periodLabel,
      columns: [
        { header: "Last payment", value: (row) => csvDate(row.date) },
        { header: "Invoice", value: (row) => row.invoice },
        { header: "Customer", value: (row) => row.customer },
        { header: "Invoice total", value: (row) => formatMoney(row.totalMinor, row.currency) },
        { header: "Collected", value: (row) => formatMoney(row.paidMinor, row.currency) },
        { header: "Due", value: (row) => formatMoney(row.dueMinor, row.currency) },
        { header: "Status", value: (row) => displayStatus(row.status) },
      ],
      rows: revenueRows,
    });

  const exportProfit = () =>
    downloadCsv<ProfitRow>(
      reportCsvFilename("profit", fromDate, toDate),
      [
        { header: "Date", value: (row) => csvDate(row.date) },
        { header: "Invoice", value: (row) => row.invoice },
        { header: "Customer", value: (row) => row.customer },
        { header: "Currency", value: (row) => row.currency },
        { header: "Sales excluding tax", value: (row) => csvMoney(row.salesMinor) },
        { header: "Parts cost", value: (row) => csvMoney(row.partsCostMinor) },
        { header: "Gross profit", value: (row) => csvMoney(row.profitMinor) },
        { header: "Cost basis", value: (row) => row.costBasis },
      ],
      profitRows
    );

  const exportProfitPdf = () =>
    downloadReportPdf<ProfitRow>({
      filename: reportPdfFilename("gross-profit", fromDate, toDate),
      title: "Gross profit report",
      periodLabel,
      columns: [
        { header: "Date", value: (row) => csvDate(row.date) },
        { header: "Invoice", value: (row) => row.invoice },
        { header: "Customer", value: (row) => row.customer },
        { header: "Sales excl. tax", value: (row) => formatMoney(row.salesMinor, row.currency) },
        { header: "Parts cost", value: (row) => formatMoney(row.partsCostMinor, row.currency) },
        { header: "Gross profit", value: (row) => formatMoney(row.profitMinor, row.currency) },
        { header: "Cost basis", value: (row) => row.costBasis },
      ],
      rows: profitRows,
    });

  const exportCompletedJobs = () =>
    downloadCsv<CompletedJobRow>(
      reportCsvFilename("completed-jobs", fromDate, toDate),
      [
        { header: "Completion date", value: (row) => csvDate(row.date) },
        { header: "Job", value: (row) => row.job },
        { header: "Customer", value: (row) => row.customer },
        { header: "Registration", value: (row) => row.plateNumber },
        { header: "Vehicle", value: (row) => row.vehicle },
        { header: "Complaint", value: (row) => row.complaint },
        { header: "Invoice", value: (row) => row.invoice },
        { header: "Total", value: (row) => csvMoney(row.totalMinor) },
      ],
      completedJobRows
    );

  const exportCompletedJobsPdf = () =>
    downloadReportPdf<CompletedJobRow>({
      filename: reportPdfFilename("completed-jobs", fromDate, toDate),
      title: "Completed jobs report",
      periodLabel,
      columns: [
        { header: "Completed", value: (row) => csvDate(row.date) },
        { header: "Job", value: (row) => row.job },
        { header: "Customer", value: (row) => row.customer },
        { header: "Registration", value: (row) => row.plateNumber },
        { header: "Vehicle", value: (row) => row.vehicle },
        { header: "Complaint", value: (row) => row.complaint },
        { header: "Total", value: (row) => formatMoney(row.totalMinor) },
      ],
      rows: completedJobRows,
    });

  const exportInventory = () => {
    const today = localDateInput(new Date());
    downloadCsv<InventoryRow>(
      `belt-kit-inventory-snapshot-${today}.csv`,
      [
        { header: "SKU", value: (row) => row.sku },
        { header: "Part", value: (row) => row.name },
        { header: "Quantity on hand", value: (row) => row.quantity },
        { header: "Reorder level", value: (row) => row.reorderLevel },
        { header: "Low stock", value: (row) => row.lowStock },
        { header: "Bin location", value: (row) => row.binLocation },
        { header: "Unit cost", value: (row) => csvMoney(row.unitCostMinor) },
        { header: "Selling price", value: (row) => csvMoney(row.sellPriceMinor) },
        { header: "Stock cost value", value: (row) => csvMoney(row.costValueMinor) },
        { header: "Stock retail value", value: (row) => csvMoney(row.retailValueMinor) },
      ],
      inventoryRows
    );
  };

  const exportInventoryPdf = () => {
    const today = localDateInput(new Date());
    downloadReportPdf<InventoryRow>({
      filename: `belt-kit-inventory-snapshot-${today}.pdf`,
      title: "Inventory snapshot",
      periodLabel: "Current inventory snapshot",
      columns: [
        { header: "SKU", value: (row) => row.sku },
        { header: "Part", value: (row) => row.name },
        { header: "On hand", value: (row) => row.quantity },
        { header: "Reorder at", value: (row) => row.reorderLevel },
        { header: "Status", value: (row) => row.lowStock ? "Low stock" : "In stock" },
        { header: "Bin", value: (row) => row.binLocation },
        { header: "Unit cost", value: (row) => formatMoney(row.unitCostMinor) },
        { header: "Retail value", value: (row) => formatMoney(row.retailValueMinor) },
      ],
      rows: inventoryRows,
    });
  };

  const loading =
    invoicesLoading || paymentsLoading || customersLoading || vehiclesLoading ||
    jobsLoading || partsLoading;
  const errors = [
    invoicesError,
    paymentsError,
    customersError,
    vehiclesError,
    jobsError,
    partsError,
  ].filter((error): error is string => Boolean(error));

  if (!canViewReports(role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Finance" title="Reports" icon={BarChart3} />
        <div className="card p-10 text-center">
          <ShieldAlert size={34} className="mx-auto text-burgundy-500" />
          <h2 className="mt-4 text-lg font-semibold text-ink">Reports access is restricted</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Owners, managers, advisors and accountants can view financial and operational reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Finance & operations" title="Reports" icon={BarChart3} />

      <section className="card mb-5 p-5" aria-labelledby="report-period-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink" id="report-period-heading">
              <CalendarDays size={16} className="text-burgundy-500" /> Report period
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Applies to revenue, profit and completed jobs. Inventory is always a live snapshot.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <span className="label-luxe">From</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input-luxe min-w-40" />
            </label>
            <label className="block">
              <span className="label-luxe">To</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="input-luxe min-w-40" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={setThisMonth} className="btn-ghost !px-3 !py-2.5 text-xs">This month</button>
              <button type="button" onClick={setLast30Days} className="btn-ghost !px-3 !py-2.5 text-xs">Last 30 days</button>
              <button type="button" onClick={() => { setFromDate(""); setToDate(""); }} disabled={!fromDate && !toDate} className="btn-ghost !px-3 !py-2.5 text-xs">All time</button>
            </div>
          </div>
        </div>
        {invalidRange ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} /> The start date must be before or equal to the end date.
          </div>
        ) : (
          <p className="mt-4 text-xs font-medium text-burgundy-600">{periodLabel}</p>
        )}
      </section>

      {errors.length > 0 && (
        <div className="mb-5 rounded-xl bg-burgundy-50 px-4 py-3 text-sm text-burgundy-700">
          Some report data could not be loaded: {Array.from(new Set(errors)).join(" ")}
        </div>
      )}

      {loading ? (
        <TableSkeleton cols={5} rows={6} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportCard
              active={activeReport === "revenue"}
              icon={Receipt}
              title="Revenue"
              description="Payments collected in the selected period, grouped by invoice."
              value={formatMoney(totalCollected, primaryCurrency)}
              hint={`${revenueRows.length} paid invoices · ${formatMoney(totalInvoiced, primaryCurrency)} invoiced`}
              onSelect={() => setActiveReport("revenue")}
              onDownload={exportRevenue}
              onDownloadPdf={exportRevenuePdf}
              downloadDisabled={invalidRange}
            />
            <ReportCard
              active={activeReport === "profit"}
              icon={TrendingUp}
              title="Gross profit"
              description="Sales excluding tax, less the recorded or estimated parts cost."
              value={formatMoney(totalProfit, primaryCurrency)}
              hint={`${profitRows.length} invoices in ${periodLabel.toLocaleLowerCase()}`}
              onSelect={() => setActiveReport("profit")}
              onDownload={exportProfit}
              onDownloadPdf={exportProfitPdf}
              downloadDisabled={invalidRange}
            />
            <ReportCard
              active={activeReport === "jobs"}
              icon={ClipboardList}
              title="Completed jobs"
              description="Delivered jobs grouped by their actual completion date when available."
              value={String(completedJobRows.length)}
              hint={`Delivered in ${periodLabel.toLocaleLowerCase()}`}
              onSelect={() => setActiveReport("jobs")}
              onDownload={exportCompletedJobs}
              onDownloadPdf={exportCompletedJobsPdf}
              downloadDisabled={invalidRange}
            />
            <ReportCard
              active={activeReport === "inventory"}
              icon={Package}
              title="Inventory snapshot"
              description="Current stock quantities, reorder warnings and inventory value."
              value={formatMoney(inventoryRetailValue)}
              hint={`${inventoryRows.length} parts · ${lowStockCount} low stock`}
              onSelect={() => setActiveReport("inventory")}
              onDownload={exportInventory}
              onDownloadPdf={exportInventoryPdf}
            />
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">On-screen preview</p>
                <h2 className="mt-0.5 text-base font-semibold text-ink">
                  {activeReport === "revenue" && "Revenue report"}
                  {activeReport === "profit" && "Gross profit report"}
                  {activeReport === "jobs" && "Completed jobs report"}
                  {activeReport === "inventory" && "Inventory report"}
                </h2>
              </div>
              <p className="text-xs text-ink-faint">
                {activeReport === "inventory" ? "Current inventory snapshot" : periodLabel}
              </p>
            </div>
            {activeReport === "revenue" && <RevenueTable rows={revenueRows} />}
            {activeReport === "profit" && <ProfitTable rows={profitRows} />}
            {activeReport === "jobs" && <CompletedJobsTable rows={completedJobRows} />}
            {activeReport === "inventory" && <InventoryTable rows={inventoryRows} />}
          </section>
        </>
      )}
    </div>
  );
}
