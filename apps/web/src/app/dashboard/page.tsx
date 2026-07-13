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
  Zap,
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Car,
  Calendar,
  RefreshCw,
  Star,
  Flame,
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

// ─── Status color map ────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  neutral: VIZ.slate,
  blue:    VIZ.sky,
  amber:   VIZ.amber,
  gold:    VIZ.violet,
  green:   VIZ.emerald,
  burgundy:VIZ.indigo,
};

// ─── UI-only: KPI progress ring ──────────────────────────────────────────────
function KPIRing({
  label, value, max, color, icon: Icon, suffix = "%",
}: {
  label: string; value: number; max: number; color: string; icon: React.ElementType; suffix?: string;
}) {
  const pct  = Math.min(100, (value / max) * 100);
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[72px] w-[72px] items-center justify-center">
        <svg width="72" height="72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5" stroke="rgba(255,255,255,0.05)" />
          <circle
            cx="36" cy="36" r={r} fill="none" strokeWidth="5"
            stroke={color} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-ink tabular-nums">{value}{suffix !== "%" ? suffix : ""}</p>
        <p className="text-[10px] text-ink-faint leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ─── UI-only: Activity feed item ─────────────────────────────────────────────
type FeedItem = {
  icon: React.ElementType;
  color: string;
  bg: string;
  title: string;
  meta: string;
  time: string;
};

const MOCK_FEED: FeedItem[] = [
  { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Job #1042 marked delivered",    meta: "Toyota Camry · John Smith",      time: "2m" },
  { icon: Wallet,       color: "text-rosegold-400",  bg: "bg-rosegold-500/10",  title: "Invoice INV-091 paid",         meta: "₹12,400 · Sarah Connor",       time: "18m" },
  { icon: AlertTriangle,color: "text-amber-400",   bg: "bg-amber-500/10",    title: "Low stock alert: Brake Pads", meta: "Only 3 units left",             time: "1h" },
  { icon: Car,          color: "text-burgundy-300", bg: "bg-burgundy-600/10", title: "New vehicle registered",      meta: "MH12-AB-1234 · Honda Civic",    time: "2h" },
  { icon: Users,        color: "text-sky-400",      bg: "bg-sky-500/10",      title: "New customer onboarded",      meta: "Raj Patel · +91-98765-43210",   time: "3h" },
];

// ─── UI-only: mini metric chip ────────────────────────────────────────────────
function MetricChip({ label, value, trend }: { label: string; value: string; trend: "up" | "down" | "flat" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line/50 bg-surface-muted/40 px-4 py-3 transition hover:border-burgundy-700/40">
      <div>
        <p className="text-[11px] text-ink-faint">{label}</p>
        <p className="text-[15px] font-bold text-ink tabular-nums">{value}</p>
      </div>
      <span className={trend === "up" ? "trend-up" : trend === "down" ? "trend-down" : "trend-flat"}>
        {trend === "up" ? <ChevronUp size={10} /> : trend === "down" ? <ChevronDown size={10} /> : null}
        {trend === "up" ? "+8%" : trend === "down" ? "-3%" : "—"}
      </span>
    </div>
  );
}

// ─── UI-only: service bay slot ────────────────────────────────────────────────
const BAY_SLOTS = [
  { bay: "Bay 1", status: "occupied",  job: "#1042", tech: "Alex",  car: "Toyota Camry",  pct: 75 },
  { bay: "Bay 2", status: "occupied",  job: "#1039", tech: "Maria", car: "Honda Civic",   pct: 40 },
  { bay: "Bay 3", status: "idle",      job: null,    tech: null,    car: null,             pct: 0  },
  { bay: "Bay 4", status: "occupied",  job: "#1043", tech: "Sam",   car: "Maruti Swift",  pct: 20 },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardHome() {
  const { user, role } = useAuth();

  const { data: allJobs }   = useCollection<JobCard>("jobCards");
  const jobs = role === "technician"
    ? allJobs.filter((j) => (j.assignedTechnicianIds || []).includes(auth.currentUser?.uid ?? ""))
    : allJobs;
  const { data: customers } = useCollection<Customer>("customers");
  const { data: parts }     = useCollection<Part>("parts");
  const { data: invoices }  = useCollection<Invoice>("invoices");

  const openJobs    = jobs.filter((j) => j.status !== "delivered").length;
  const lowStock    = parts.filter((p) => p.lowStock).length;
  const collected   = invoices.reduce((s, i) => s + (i.amountPaidMinor || 0), 0);
  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "void")
    .reduce((s, i) => s + (i.totalMinor - i.amountPaidMinor), 0);

  const greeting =
    new Date().getHours() < 12 ? "Good morning"
    : new Date().getHours() < 18 ? "Good afternoon"
    : "Good evening";

  const revenueSeries = useMemo(() => {
    const days: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key:   d.toISOString().slice(0, 10),
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
        name:  JOB_STATUS_META[s].label,
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

  const showFinance   = canRead(role, "invoices");
  const showInventory = role === "owner" || role === "manager" || role === "advisor";

  const stagger = (i: number) => ({ duration: 0.4, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const });

  return (
    <div className="mx-auto max-w-7xl space-y-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-burgundy-700/40 bg-burgundy-600/10 px-2.5 py-1 text-[11px] font-semibold text-burgundy-300">
                <Flame size={10} /> {role ? ROLE_META[role].label : "Welcome"}
              </span>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-ink">
              {greeting},{" "}
              <span className="bg-gradient-to-r from-burgundy-300 to-rosegold-300 bg-clip-text text-transparent">
                {(user?.displayName ?? user?.email ?? "there").split("@")[0]}
              </span>
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Here&apos;s what&apos;s happening across your workshop today.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface-muted/50 px-3.5 py-2 text-[12px] font-medium text-ink-faint transition hover:text-ink hover:bg-surface-muted">
              <Calendar size={13} /> Today
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface-muted/50 px-3.5 py-2 text-[12px] font-medium text-ink-faint transition hover:text-ink hover:bg-surface-muted">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label:   role === "technician" ? "My Open Jobs" : "Open Jobs",
            value:   String(openJobs),
            hint:    "Not yet delivered",
            icon:    <ClipboardList size={17} />,
            accent:  VIZ.indigo,
            show:    true,
            trend:   "up",
          },
          {
            label:   "Customers",
            value:   String(customers.length),
            hint:    "On file",
            icon:    <Users size={17} />,
            accent:  VIZ.teal,
            show:    canRead(role, "customers"),
            trend:   "up",
          },
          {
            label:   "Collected",
            value:   formatMoney(collected),
            hint:    "Payments received",
            icon:    <Wallet size={17} />,
            accent:  VIZ.emerald,
            spark:   revSpark,
            sparkColor: VIZ.emerald,
            show:    showFinance,
            trend:   "up",
          },
          {
            label:   "Outstanding",
            value:   formatMoney(outstanding),
            hint:    "Awaiting payment",
            icon:    <TrendingUp size={17} />,
            accent:  VIZ.amber,
            show:    showFinance,
            trend:   "down",
          },
        ]
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

      {/* ── KPI Progress Rings (UI only) ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(3)}
        className="card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Performance Targets</h2>
            <p className="text-xs text-ink-faint">Current month vs. goal</p>
          </div>
          <span className="rounded-full border border-rosegold-700/40 bg-rosegold-500/10 px-2.5 py-1 text-[10px] font-semibold text-rosegold-300">
            July 2026
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-around gap-6 py-2">
          <KPIRing label="Job Completion"  value={78}  max={100} color={VIZ.indigo}  icon={CheckCircle2} />
          <KPIRing label="Revenue Goal"    value={62}  max={100} color={VIZ.emerald} icon={Wallet}       />
          <KPIRing label="Customer Sat."   value={91}  max={100} color={VIZ.violet}  icon={Star}         />
          <KPIRing label="On-time Deliver" value={84}  max={100} color={VIZ.teal}    icon={Clock}        />
          <KPIRing label="Parts Efficiency"value={55}  max={100} color={VIZ.amber}   icon={Package}      />
          <KPIRing label="Active Technicians" value={3} max={5}  color={VIZ.sky}     icon={Users}  suffix="/5" />
        </div>
      </motion.div>

      {/* ── Revenue chart + Status donut ── */}
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
                className="flex items-center gap-1 text-xs font-medium text-burgundy-300 hover:text-burgundy-200">
                Billing <ArrowUpRight size={13} />
              </Link>
            </div>
            <AreaTrend
              data={revenueSeries}
              color={VIZ.indigo}
              formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            {/* mini metrics below chart */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricChip label="Avg/day"   value="₹4.2k" trend="up" />
              <MetricChip label="Best day"  value="₹9.8k" trend="flat" />
              <MetricChip label="vs last wk" value="₹28k" trend="up" />
            </div>
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

      {/* ── Service Bays (UI only) + Activity feed ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Service bay monitor */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(6)}
          className="card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Zap size={14} className="text-rosegold-400" /> Service Bay Monitor
              </h2>
              <p className="text-xs text-ink-faint">Live workshop status</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="space-y-2.5">
            {BAY_SLOTS.map((bay) => (
              <div key={bay.bay}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  bay.status === "idle"
                    ? "border-line/40 bg-surface-muted/20"
                    : "border-burgundy-800/40 bg-burgundy-600/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2 w-2 rounded-full ${bay.status === "idle" ? "bg-line" : "bg-emerald-400 animate-pulse"}`} />
                    <span className="text-[12px] font-semibold text-ink">{bay.bay}</span>
                    {bay.job && (
                      <span className="rounded-md bg-burgundy-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-burgundy-300">
                        {bay.job}
                      </span>
                    )}
                  </div>
                  {bay.status === "idle" ? (
                    <span className="text-[11px] text-ink-faint">Available</span>
                  ) : (
                    <span className="text-[11px] text-ink-soft">{bay.tech}</span>
                  )}
                </div>
                {bay.status !== "idle" && (
                  <>
                    <p className="text-[11px] text-ink-faint mb-1.5">{bay.car}</p>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${bay.pct}%` }} />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-ink-faint">{bay.pct}%</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(7)}
          className="card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Activity size={14} className="text-burgundy-300" /> Activity Feed
              </h2>
              <p className="text-xs text-ink-faint">Recent events</p>
            </div>
            <button className="rounded-lg p-1 text-ink-faint hover:text-ink transition">
              <MoreHorizontal size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {MOCK_FEED.map((item, i) => (
              <div key={i}
                className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-white/4 cursor-pointer"
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                  <item.icon size={13} className={item.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-ink truncate">{item.title}</p>
                  <p className="text-[11px] text-ink-faint truncate">{item.meta}</p>
                </div>
                <span className="shrink-0 text-[10px] text-ink-faint">{item.time}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-line/40 pt-3">
            <button className="w-full rounded-xl border border-line/40 bg-surface-muted/30 py-2 text-[11px] font-medium text-ink-faint transition hover:text-ink hover:bg-surface-muted/60">
              View full activity log
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── Inventory bars + Recent jobs ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {showInventory && inventoryBars.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(8)}
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
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={stagger(9)}
            className={`card p-5 ${showInventory ? "lg:col-span-2" : "lg:col-span-3"}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Target size={14} className="text-burgundy-300" />
                {role === "technician" ? "My Jobs" : "Recent Activity"}
              </h2>
              <Link href="/dashboard/job-cards"
                className="text-xs font-medium text-burgundy-300 hover:text-burgundy-200 transition">
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
              <div className="divide-y divide-line/40">
                {recent.map((j) => (
                  <Link
                    key={j.id}
                    href={`/dashboard/job-cards/${j.id}`}
                    className="group flex items-center justify-between gap-4 py-3 transition-colors hover:bg-white/3 rounded-lg px-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATUS_COLOR[JOB_STATUS_META[j.status].tone] ?? VIZ.slate }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink group-hover:text-burgundy-300 transition-colors">
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

    </div>
  );
}
