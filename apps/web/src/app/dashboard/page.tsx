"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ClipboardList,
  Users,
  Package,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ROLE_META } from "@/lib/roles";
import { canRead } from "@/lib/permissions";
import { JobCard, Customer, Part, Invoice } from "@/lib/models";
import { formatMoney } from "@/lib/format";

export default function DashboardHome() {
  const { user, role } = useAuth();

  // useCollection already returns empty (no query) for collections this role
  // can't read, so these are safe to call for every role.
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

  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";

  // Build stat cards from only what this role can see.
  const ALL_STATS = [
    {
      key: "jobs",
      show: canRead(role, "jobCards"),
      label: role === "technician" ? "My Open Jobs" : "Open Job Cards",
      value: String(openJobs),
      icon: ClipboardList,
      hint: "Not yet delivered",
      href: "/dashboard/job-cards",
    },
    {
      key: "customers",
      show: canRead(role, "customers"),
      label: "Customers",
      value: String(customers.length),
      icon: Users,
      hint: "On file",
      href: "/dashboard/customers",
    },
    {
      key: "parts",
      show: role === "owner" || role === "manager" || role === "advisor",
      label: "Low-Stock Parts",
      value: String(lowStock),
      icon: Package,
      hint: "Below reorder level",
      href: "/dashboard/inventory",
    },
    {
      key: "collected",
      show: canRead(role, "invoices"),
      label: "Collected",
      value: formatMoney(collected),
      icon: Receipt,
      hint: "Payments received",
      href: "/dashboard/billing",
    },
  ];
  const STATS = ALL_STATS.filter((s) => s.show);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {role ? ROLE_META[role].label : "Welcome"}
        </p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-ink">
          {greeting},{" "}
          {(user?.displayName ?? user?.email ?? "there").split("@")[0]}
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Here&apos;s an overview of your workshop today.
        </p>
      </div>

      {STATS.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
            STATS.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {STATS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={s.href}
                  className="card group block p-5 hover:border-burgundy-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-700">
                      <Icon size={17} />
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="text-ink-faint transition-colors group-hover:text-burgundy-500"
                    />
                  </div>
                  <p className="mt-4 text-[26px] font-semibold tracking-tight text-ink">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-ink-soft">
                    {s.label}
                  </p>
                  <p className="text-xs text-ink-faint">{s.hint}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {canRead(role, "jobCards") && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="card mt-6 p-7"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">
              {role === "technician" ? "My jobs" : "Recent activity"}
            </h2>
            <Link
              href="/dashboard/job-cards"
              className="font-sans text-sm text-burgundy-600 hover:text-burgundy-700"
            >
              View all
            </Link>
          </div>
          {jobs.length === 0 ? (
            <p className="py-6 text-center font-sans text-sm text-ink-soft">
              {role === "technician"
                ? "No jobs are assigned to you yet."
                : "No job cards yet. Head to Job Cards to open your first one."}
            </p>
          ) : (
            <div className="space-y-2">
              {jobs
                .slice()
                .sort(
                  (a, b) =>
                    (b.createdAt?.toMillis?.() ?? 0) -
                    (a.createdAt?.toMillis?.() ?? 0)
                )
                .slice(0, 5)
                .map((j) => (
                  <Link
                    key={j.id}
                    href={`/dashboard/job-cards/${j.id}`}
                    className="flex items-center justify-between rounded-xl border border-line px-4 py-3 transition hover:bg-surface-muted/50"
                  >
                    <span className="truncate font-sans text-sm text-ink">
                      {j.complaint}
                    </span>
                    <span className="font-sans text-sm font-medium text-burgundy-600">
                      {formatMoney(j.totalMinor)}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
