"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Car,
  Package,
  Receipt,
  UserCog,
  LogOut,
  Loader2,
  Search,
  Command,
  ChevronDown,
  Bell,
  Settings,
  BarChart3,
  Zap,
  Shield,
  HelpCircle,
  Wrench,
  FileText,
  TrendingUp,
  MessageSquare,
  Calendar,
  Star,
  Target,
  Activity,
  Cpu,
  Globe,
  ChevronRight,
} from "lucide-react";
import { useAuth, Role } from "@/lib/auth-context";
import { ROLE_META } from "@/lib/roles";
import { CommandBar } from "@/components/CommandBar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  badge?: string;
  badgeColor?: string;
};

// ─── Real working nav (unchanged) ───────────────────────────────────────────
const CORE_NAV: NavItem[] = [
  { href: "/dashboard",            label: "Overview",     icon: LayoutDashboard, roles: ["owner","manager","advisor","technician","accountant"] },
  { href: "/dashboard/job-cards",  label: "Job Cards",    icon: ClipboardList,   roles: ["owner","manager","advisor","technician","accountant"] },
  { href: "/dashboard/customers",  label: "Customers",    icon: Users,           roles: ["owner","manager","advisor","accountant"] },
  { href: "/dashboard/vehicles",   label: "Vehicles",     icon: Car,             roles: ["owner","manager","advisor","accountant"] },
  { href: "/dashboard/inventory",  label: "Inventory",    icon: Package,         roles: ["owner","manager","advisor"] },
  { href: "/dashboard/billing",    label: "Billing",      icon: Receipt,         roles: ["owner","manager","accountant"] },
  { href: "/dashboard/users",      label: "Users & Roles",icon: UserCog,         roles: ["owner","manager"] },
];

// ─── UI-only feature nav sections (frontend only, no routing needed) ─────────
type UISection = {
  label: string;
  items: {
    icon: React.ElementType;
    label: string;
    badge?: string;
    badgeColor?: string;
    dot?: boolean;
  }[];
};

const ANALYTICS_SECTION: UISection = {
  label: "Analytics",
  items: [
    { icon: BarChart3,   label: "Reports",       badge: "New", badgeColor: "violet" },
    { icon: TrendingUp,  label: "Revenue Trends" },
    { icon: Target,      label: "KPI Tracker",   dot: true },
    { icon: Activity,    label: "Live Monitor",   badge: "Live", badgeColor: "emerald" },
  ],
};

const OPERATIONS_SECTION: UISection = {
  label: "Operations",
  items: [
    { icon: Calendar,    label: "Schedule" },
    { icon: Wrench,      label: "Service Bay",   badge: "3", badgeColor: "amber" },
    { icon: MessageSquare, label: "Messages",    badge: "12", badgeColor: "violet" },
    { icon: FileText,    label: "Templates" },
  ],
};

const SYSTEM_SECTION: UISection = {
  label: "System",
  items: [
    { icon: Shield,      label: "Security" },
    { icon: Cpu,         label: "Integrations",  badge: "Beta", badgeColor: "sky" },
    { icon: Globe,       label: "Multi-branch" },
    { icon: Star,        label: "Upgrade Plan",  dot: true },
  ],
};

// ─── Badge color map (dark sidebar) ─────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  violet:  "bg-white/10 text-white/70",
  emerald: "bg-emerald-500/20 text-emerald-300",
  amber:   "bg-amber-500/20 text-amber-300",
  sky:     "bg-sky-500/20 text-sky-300",
  rose:    "bg-rose-500/20 text-rose-300",
};

function CollapseSection({ section, defaultOpen = true }: { section: UISection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-section-label flex w-full items-center justify-between pr-4 hover:text-white/60 transition-colors"
      >
        <span>{section.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 px-2 pb-1">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-faint transition-all duration-150 hover:bg-white/5 hover:text-ink"
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-ink-faint group-hover:bg-burgundy-600/20 group-hover:text-burgundy-300 transition-colors">
                    <item.icon size={14} />
                    {item.dot && <span className="notif-dot" />}
                  </span>
                  <span className="flex-1 text-left text-[13px]">{item.label}</span>
                  {item.badge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[item.badgeColor ?? "violet"] ?? BADGE_COLORS.violet}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, branchId, loading, roleResolved, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !roleResolved) return;
    if (role) return;
    (async () => {
      const ref  = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          role: "pending", branchId: "main",
          displayName: user.displayName ?? user.email ?? "",
          email: user.email ?? "", active: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    })();
  }, [user, role, roleResolved]);

  if (loading || !user || !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-burgundy-600/30" />
            <div className="absolute inset-0 rounded-full border-t-2 border-burgundy-400 animate-spin" />
          </div>
          <p className="text-sm text-ink-faint">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!role || role === "pending" || role === "customer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="card max-w-md p-8 text-center shadow-luxe">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl icon-tile-gradient text-white shadow-glow">
            <UserCog size={26} />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {role === "customer" ? "Customer portal coming soon" : "Waiting for access"}
          </h1>
          <p className="mt-2 font-sans text-sm text-ink-soft">
            {role === "customer"
              ? "Customer accounts will use a dedicated self-service portal in a later release."
              : "Your account is registered. An owner or manager needs to assign you a role before you can start."}
          </p>
          <p className="mt-4 font-sans text-xs text-ink-faint">Signed in as {user.email}</p>
          <button onClick={() => logout()} className="btn-ghost mt-6">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = CORE_NAV.filter((n) => !role || n.roles.includes(role));
  const roleLabel  = role ? ROLE_META[role].label : "No role assigned";
  const initials   = (user.displayName ?? user.email ?? "?")[0]?.toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas">
      <CommandBar />

      {/* ─── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="relative hidden w-64 flex-col border-r border-white/5 lg:flex overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1A1D2E 0%, #20243A 50%, #1A1D2E 100%)" }}
      >
        {/* Ambient glow top */}
        <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-burgundy-400/10 blur-3xl" />

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 px-5 py-5 border-b border-white/8">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl icon-tile-gradient text-white text-sm font-bold shadow-glow">
            B
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1A1D2E]" />
          </div>
          <div>
            <p className="text-[14px] font-bold leading-none tracking-tight text-white">Belt-Kit</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/40">Garage ERP</p>
          </div>
          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative ml-auto rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white"
          >
            <Bell size={15} />
            <span className="notif-dot" />
          </button>
        </div>

        {/* ── Notification tray ─────────────────────────────────────────── */}
        <AnimatePresence>
          {notifOpen && (
            <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/8 bg-black/20"
          >
              <div className="px-4 py-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Notifications</p>
                {[
                  { label: "Job #1042 completed", time: "2m ago", color: "bg-emerald-400" },
                  { label: "Low stock: Brake Pads", time: "18m ago", color: "bg-rosegold-400" },
                  { label: "Invoice overdue · TK-091", time: "1h ago", color: "bg-rose-400" },
                ].map((n) => (
                  <div key={n.label} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.color}`} />
                      <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white/80 truncate">{n.label}</p>
                          <p className="text-[10px] text-white/40">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Search ────────────────────────────────────────────────────── */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
            }
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[12px] text-white/40 transition-all duration-200 hover:border-white/20 hover:text-white/70 hover:bg-white/10"
          >
            <Search size={13} className="shrink-0" />
            <span className="flex-1 text-left">Search commands…</span>
            <kbd className="flex items-center gap-0.5 rounded border border-white/10 bg-white/8 px-1.5 py-0.5 text-[9px] font-medium text-white/40">
              <Command size={8} />K
            </kbd>
          </button>
        </div>

        {/* ── Core nav ──────────────────────────────────────────────────── */}
        <div className="sidebar-section-label flex items-center gap-2">
          <Zap size={9} className="text-burgundy-400" />
          Workspace
        </div>
        <nav className="space-y-0.5 px-2">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "bg-white/6 text-white/40"
                }`}>
                  <Icon size={14} />
                </span>
                <span className="flex-1 text-[13px]">{item.label}</span>
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-burgundy-400 shadow-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Collapsible feature sections ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-2 scrollbar-thin">
          <CollapseSection section={ANALYTICS_SECTION} defaultOpen={true} />
          <CollapseSection section={OPERATIONS_SECTION} defaultOpen={false} />
          <CollapseSection section={SYSTEM_SECTION} defaultOpen={false} />
        </div>

        {/* ── System health pill ────────────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-white/40">System operational</span>
            <span className="ml-auto text-[10px] font-semibold text-emerald-400">99.9%</span>
          </div>
        </div>

        {/* ── Bottom user section ───────────────────────────────────────── */}
        <div className="border-t border-line/50 p-3 space-y-2">
          {/* Settings + Help row */}
          <div className="flex gap-1">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/4 py-2 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/70">
              <Settings size={12} /> Settings
            </button>
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/4 py-2 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/70">
              <HelpCircle size={12} /> Help
            </button>
          </div>

          {/* User profile */}
          <div className="flex items-center gap-2.5 rounded-xl bg-white/6 px-3 py-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #6941F0, #F59000)" }}>
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1A1D2E]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white/85">
                {user.displayName ?? user.email?.split("@")[0]}
              </p>
              <p className="truncate text-[10px] text-white/40">{roleLabel}</p>
            </div>
            <button
              onClick={() => logout()}
              className="rounded-lg p-1 text-ink-faint transition hover:text-rose-400"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN AREA ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-4 lg:hidden">
          <span className="text-[15px] font-bold tracking-tight text-ink">Belt-Kit</span>
          <button onClick={() => logout()} className="text-ink-soft hover:text-burgundy-500">
            <LogOut size={18} />
          </button>
        </header>

        {/* Top bar (desktop) */}
        <div className="hidden lg:flex items-center justify-between border-b border-line bg-white px-8 py-3 shadow-soft">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="font-semibold text-ink">Dashboard</span>
            <ChevronRight size={12} />
            <span>{CORE_NAV.find((n) => n.href === pathname)?.label ?? "Overview"}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick action pills */}
            <div className="flex items-center gap-1.5">
              {[
                { icon: Zap,      label: "Quick Job",  color: "text-rosegold-500" },
                { icon: Users,    label: "Add Client", color: "text-burgundy-600" },
                { icon: FileText, label: "Invoice",    color: "text-emerald-600"  },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-[11px] font-medium text-ink-faint transition-all hover:border-burgundy-300 hover:text-ink hover:bg-burgundy-50/50"
                >
                  <a.icon size={11} className={a.color} />
                  {a.label}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-line/50" />
            {/* Online avatars */}
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {["#6941F0","#F59000","#0B9E8C"].map((c, i) => (
                  <div key={i}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white"
                    style={{ background: c }}
                  >
                    {["A","B","C"][i]}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-ink-faint ml-1">3 online</span>
            </div>
          </div>
        </div>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 px-6 py-6 lg:px-8 lg:py-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
