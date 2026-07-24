"use client";

/**
 * Global ⌘K / Ctrl-K command palette.
 * Searches customers, job cards, vehicles and invoices (all role-gated through
 * useCollection) plus quick navigation actions. Read-only — pure navigation.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Users,
  Car,
  ClipboardList,
  Receipt,
  Package,
  LayoutDashboard,
  BarChart3,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Bot,
} from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { Customer, Vehicle, JobCard, Invoice } from "@/lib/models";
import { useAuth } from "@/lib/auth-context";
import { canViewReports } from "@/lib/permissions";

type Item = {
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  href: string;
  group: string;
};

export function CommandBar() {
  const router = useRouter();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const { data: customers } = useCollection<Customer>("customers");
  const { data: vehicles } = useCollection<Vehicle>("vehicles");
  const { data: jobs } = useCollection<JobCard>("jobCards");
  const { data: invoices } = useCollection<Invoice>("invoices");

  // Toggle with ⌘K / Ctrl-K; close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const nav: Item[] = useMemo(
    () => [
      { id: "n-dash", label: "Overview", icon: LayoutDashboard, href: "/dashboard", group: "Go to" },
      { id: "n-jobs", label: "Job Cards", icon: ClipboardList, href: "/dashboard/job-cards", group: "Go to" },
      { id: "n-cust", label: "Customers", icon: Users, href: "/dashboard/customers", group: "Go to" },
      { id: "n-veh", label: "Vehicles", icon: Car, href: "/dashboard/vehicles", group: "Go to" },
      { id: "n-inv", label: "Inventory", icon: Package, href: "/dashboard/inventory", group: "Go to" },
      ...(role === "technician"
        ? [{ id: "n-ai", label: "Technician Assistant", icon: Bot, href: "/dashboard/technician-assistant", group: "Go to" }]
        : []),
      { id: "n-bill", label: "Billing", icon: Receipt, href: "/dashboard/billing", group: "Go to" },
      ...(canViewReports(role)
        ? [{ id: "n-reports", label: "Reports", icon: BarChart3, href: "/dashboard/reports", group: "Go to" }]
        : []),
    ],
    [role]
  );

  const custName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.displayName ?? "—",
    [customers]
  );

  const records: Item[] = useMemo(() => {
    const out: Item[] = [];
    customers.forEach((c) =>
      out.push({
        id: `c-${c.id}`,
        label: c.displayName,
        sub: c.phone,
        icon: Users,
        href: `/dashboard/customers/${c.id}`,
        group: "Customers",
      })
    );
    vehicles.forEach((v) =>
      out.push({
        id: `v-${v.id}`,
        label: `${v.make} ${v.model}`,
        sub: v.plateNumber,
        icon: Car,
        href: `/dashboard/vehicles/${v.id}`,
        group: "Vehicles",
      })
    );
    jobs.forEach((j) =>
      out.push({
        id: `j-${j.id}`,
        label: j.complaint,
        sub: custName(j.customerId),
        icon: ClipboardList,
        href: `/dashboard/job-cards/${j.id}`,
        group: "Job Cards",
      })
    );
    invoices.forEach((inv) =>
      out.push({
        id: `i-${inv.id}`,
        label: `Invoice · ${custName(inv.customerId)}`,
        sub: `${inv.lines?.length ?? 0} lines`,
        icon: Receipt,
        href: `/dashboard/billing/${inv.id}`,
        group: "Invoices",
      })
    );
    return out;
  }, [customers, vehicles, jobs, invoices, custName]);

  const results = useMemo(() => {
    const query = q.toLowerCase().trim();
    const pool = query ? [...nav, ...records] : nav;
    const matched = query
      ? pool.filter(
          (it) =>
            it.label.toLowerCase().includes(query) ||
            it.sub?.toLowerCase().includes(query)
        )
      : pool;
    return matched.slice(0, 40);
  }, [q, nav, records]);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  useEffect(() => {
    function onNav(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && results[active]) {
        e.preventDefault();
        go(results[active]);
      }
    }
    window.addEventListener("keydown", onNav);
    return () => window.removeEventListener("keydown", onNav);
  }, [open, results, active, go]);

  // Group results for display
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    results.forEach((r) => {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    });
    return Array.from(map.entries());
  }, [results]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-luxe-lg"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-ink-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search customers, jobs, invoices…  or jump to a page"
                className="w-full bg-transparent py-4 text-sm text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-faint">
                  No results for “{q}”.
                </p>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group} className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      {group}
                    </p>
                    {items.map((it) => {
                      flatIndex++;
                      const idx = flatIndex;
                      const Icon = it.icon;
                      const isActive = idx === active;
                      return (
                        <button
                          key={it.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(it)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                            isActive
                              ? "bg-burgundy-50 text-burgundy-700"
                              : "text-ink-soft hover:bg-surface-muted"
                          }`}
                        >
                          <Icon
                            size={16}
                            className={isActive ? "text-burgundy-600" : "text-ink-faint"}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {it.label}
                            </span>
                            {it.sub && (
                              <span className="block truncate text-xs text-ink-faint">
                                {it.sub}
                              </span>
                            )}
                          </span>
                          {isActive && (
                            <CornerDownLeft size={14} className="text-burgundy-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-faint">
              <span className="flex items-center gap-1">
                <ArrowUp size={11} />
                <ArrowDown size={11} /> navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={11} /> open
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
