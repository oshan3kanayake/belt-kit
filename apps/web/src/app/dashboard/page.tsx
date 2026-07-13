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
  Activity,
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
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        )
        .slice(0, 6),
    [jobs]
  );

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName ?? "—";

  const showFinance = canRead(role, "invoices");
  const showInventory =
    role === "owner" || role === "manager" || role === "advisor";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-burgundy-600">
          {role ? ROLE_META[role].label : "Welcome"}
        </p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink">
          {greeting}, {(user?.displayName ?? user?.email ?? "there").split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Here&apos;s what&apos;s happening across your workshop today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <StatCard
            label={role === "technician" ? "My Open Jobs" : "Open Jobs"}
            value={String(openJobs)}
            hint="Not yet delivered"
            icon={<ClipboardList size={17} />}
            accent={VIZ.indigo}
          />
        </motion.div>

        {canRead(role, "customers") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }}>
            <StatCard
              label="Customers"
              value={String(customers.length)}
              hint="On file"
              icon={<Users size={17} />}
              accent={VIZ.teal}
            />
          </motion.div>
        )}

        {showFinance && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
            <StatCard
              label="Collected"
              value={formatMoney(collected)}
              hint="Payments received"
              icon={<Wallet size={17} />}
              spark={revSpark}
              sparkColor={VIZ.emerald}
              accent={VIZ.emerald}
            />
          </motion.div>
        )}

        {showFinance ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
            <StatCard
              label="Outstanding"
              value={formatMoney(outstanding)}
              hint="Awaiting payment"
              icon={<TrendingUp size={17} />}
              accent={VIZ.amber}
            />
          </motion.div>
        ) : showInventory ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}>
            <StatCard
              label="Low-Stock Parts"
              value={String(lowStock)}
              hint="Below reorder level"
              icon={<Package size={17} />}
              accent={VIZ.rose}
            />
          </motion.div>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {showFinance && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="card p-6 lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Revenue</h2>
                <p className="text-xs text-ink-faint">Collected · last 14 days</p>
              </div>
              <Link
                href="/dashboard/billing"
                className="flex items-center gap-1 text-sm font-medium text-burgundy-600 hover:text-burgundy-700"
              >
                Billing <ArrowUpRight size={15} />
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
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.26 }}
            className={`card p-6 ${showFinance ? "" : "lg:col-span-2"}`}
          >
            <h2 className="mb-1 text-base font-semibold text-ink">Jobs by status</h2>
            <p className="mb-2 text-xs text-ink-faint">Current pipeline</p>
            <StatusDonut data={statusData} />
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {statusData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {showInventory && inventoryBars.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Stock levels</h2>
                <p className="text-xs text-ink-faint">Top parts on hand</p>
              </div>
              <Link
                href="/dashboard/inventory"
                className="flex items-center gap-1 text-sm font-medium text-burgundy-600 hover:text-burgundy-700"
              >
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <MiniBar data={inventoryBars} color={VIZ.teal} />
          </motion.div>
        )}

        {canRead(role, "jobCards") && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.34 }}
            className={`card p-6 ${showInventory ? "lg:col-span-2" : "lg:col-span-3"}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Activity size={16} className="text-burgundy-500" />
                {role === "technician" ? "My jobs" : "Recent activity"}
              </h2>
              <Link
                href="/dashboard/job-cards"
                className="text-sm font-medium text-burgundy-600 hover:text-burgundy-700"
              >
                View all
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
                    className="group flex items-center justify-between gap-4 py-3 transition-colors hover:bg-surface-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background:
                            STATUS_COLOR[JOB_STATUS_META[j.status].tone] ?? VIZ.slate,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink group-hover:text-burgundy-600">
                          {j.complaint}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {customerName(j.customerId)} · {formatDate(j.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {formatMoney(j.totalMinor)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
