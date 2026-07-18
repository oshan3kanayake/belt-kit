"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ClipboardList,
  Users,
  Package,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  Target,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ROLE_META } from "@/lib/roles";
import { canRead } from "@/lib/permissions";
import {
  JobCard,
  Customer,
  Part,
  Invoice,
  JOB_STATUS_META,
  JOB_STATUS_ORDER,
} from "@/lib/models";
import { formatMoney, formatDate } from "@/lib/format";
import { AreaTrend, StatusDonut, MiniBar, StatCard, VIZ } from "@/components/charts";
import { JobsCalendar } from "@/components/JobsCalendar";

const STATUS_COLOR: Record<string, string> = {
  neutral: VIZ.slate,
  blue: VIZ.sky,
  amber: VIZ.amber,
  gold: VIZ.violet,
  green: VIZ.emerald,
  burgundy: VIZ.indigo,
};

export default function DashboardHome() {
  const { user, role } = useAuth();

  const { data: allJobs } = useCollection<JobCard>("jobCards");
  const jobs =
    role === "technician"
      ? allJobs.filter((j) =>
          (j.assignedTechnicianIds || []).includes(auth.currentUser?.uid ?? "")
        )
      : allJobs;
  const { data: customers } = useCollection<Customer>("customers");
  const { data: parts } = useCollection<Part>("parts");
  const { data: invoices } = useCollection<Invoice>("invoices");

  const openJobs = jobs.filter((j) => j.status !== "delivered").length;
  const lowStock = parts.filter((p) => p.lowStock).length;
  const collected = invoices.reduce((s, i) => s + (i.amountPaidMinor || 0), 0);
  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((s, i) => s + (i.totalMinor - i.amountPaidMinor), 0);

  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";

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
    invoices.forEach((inv) => {
      const t = inv.createdAt?.toDate?.();
      if (!t) return;
      const k = t.toISOString().slice(0, 10);
      if (idx.has(k)) days[idx.get(k)!].value += inv.amountPaidMinor / 100;
    });
    return days;
  }, [invoices]);

  const revSpark = revenueSeries.map((d) => d.value);

  const statusData = useMemo(
    () =>
      JOB_STATUS_ORDER.map((s) => ({
        name: JOB_STATUS_META[s].label,
        value: jobs.filter((j) => j.status === s).length,
        color: STATUS_COLOR[JOB_STATUS_META[s].tone] ?? VIZ.slate,
      })).filter((d) => d.value > 0),
    [jobs]
  );

  const inventoryBars = useMemo(
    () =>
      [...parts]
        .sort((a, b) => b.quantityOnHand - a.quantityOnHand)
        .slice(0, 6)
        .map((p) => ({ label: p.sku || p.name.slice(0, 6), value: p.quantityOnHand })),
    [parts]
  );

  const recent = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .slice(0, 6),
    [jobs]
  );

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName ?? "—";

  const showFinance = canRead(role, "invoices");
  const showInventory = role === "owner" || role === "manager" || role === "advisor";

  const stagger = (i: number) => ({ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const });

  const cards = [
    {
      label: role === "technician" ? "My Open Jobs" : "Open Jobs",
      value: String(openJobs),
      hint: "Not yet delivered",
      icon: <ClipboardList size={17} />,
      accent: VIZ.indigo,
      show: true,
    },
    {
      label: "Customers",
      value: String(customers.length),
      hint: "On file",
      icon: <Users size={17} />,
      accent: VIZ.teal,
      show: canRead(role, "customers"),
    },
    {
      label: "Collected",
      value: formatMoney(collected),
      hint: "Payments received",
      icon: <Wallet size={17} />,
      accent: VIZ.emerald,
      spark: revSpark,
      sparkColor: VIZ.emerald,
      show: showFinance,
    },
    {
      label: showFinance ? "Outstanding" : "Low-Stock Parts",
      value: showFinance ? formatMoney(outstanding) : String(lowStock),
      hint: showFinance ? "Awaiting payment" : "Below reorder level",
      icon: showFinance ? <TrendingUp size={17} /> : <Package size={17} />,
      accent: showFinance ? VIZ.amber : VIZ.rose,
      show: showFinance || showInventory,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-burgundy-600">
          {role ? ROLE_META[role].label : "Welcome"}
        </p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink">
          {greeting}, {(user?.displayName ?? user?.email ?? "there").split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Here&apos;s what&apos;s happening across your workshop today.
        </p>
      </motion.div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards
          .filter((c) => c.show)
          .map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i + 1)}>
              <StatCard
                label={c.label}
                value={c.value}
                hint={c.hint}
                icon={c.icon}
                accent={c.accent}
                spark={c.spark}
                sparkColor={c.sparkColor}
              />
            </motion.div>
          ))}
      </div>

      {/* Revenue chart + Status donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {showFinance && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(4)}
            className="card p-5 lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">Revenue Trend</h2>
                <p className="text-xs text-ink-faint">Collected · last 14 days</p>
              </div>
              <Link href="/dashboard/billing"
                className="flex items-center gap-1 text-xs font-medium text-burgundy-600 hover:text-burgundy-700">
                Billing <ArrowUpRight size={13} />
              </Link>
            </div>
            <AreaTrend
              data={revenueSeries}
              color={VIZ.indigo}
              formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
          </motion.div>
        )}

        {canRead(role, "jobCards") && statusData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(5)}
            className={`card p-5 ${showFinance ? "" : "lg:col-span-2"}`}
          >
            <h2 className="mb-1 text-sm font-semibold text-ink">Jobs by Status</h2>
            <p className="mb-3 text-xs text-ink-faint">Current pipeline</p>
            <StatusDonut data={statusData} />
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {statusData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Inventory bars + Recent jobs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {showInventory && inventoryBars.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(6)}
            className="card p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">Stock Levels</h2>
                <p className="text-xs text-ink-faint">Top parts on hand</p>
              </div>
              <Link href="/dashboard/inventory" className="text-ink-faint hover:text-ink transition">
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <MiniBar data={inventoryBars} color={VIZ.teal} />
          </motion.div>
        )}

        {canRead(role, "jobCards") && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(7)}
            className={`card p-5 ${showInventory ? "lg:col-span-2" : "lg:col-span-3"}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Target size={14} className="text-burgundy-500" />
                {role === "technician" ? "My Jobs" : "Recent Activity"}
              </h2>
              <Link href="/dashboard/job-cards"
                className="text-xs font-medium text-burgundy-600 hover:text-burgundy-700 transition">
                View all →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">
                {role === "technician"
                  ? "No jobs are assigned to you yet."
                  : "No job cards yet. Open your first one from Job Cards."}
              </p>
            ) : (
              <div className="divide-y divide-line/70">
                {recent.map((j) => (
                  <Link
                    key={j.id}
                    href={`/dashboard/job-cards/${j.id}`}
                    className="group flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATUS_COLOR[JOB_STATUS_META[j.status].tone] ?? VIZ.slate }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink transition-colors group-hover:text-burgundy-600">
                          {j.complaint}
                        </p>
                        <p className="truncate text-[11px] text-ink-faint">
                          {customerName(j.customerId)} · {formatDate(j.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-ink tabular-nums">
                      {formatMoney(j.totalMinor)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Job calendar */}
      {canRead(role, "jobCards") && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(8)}>
          <JobsCalendar jobs={jobs} customerName={customerName} />
        </motion.div>
      )}

    </div>
  );
}
