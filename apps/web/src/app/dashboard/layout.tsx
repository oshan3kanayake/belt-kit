"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { useAuth, Role } from "@/lib/auth-context";
import { ROLE_META } from "@/lib/roles";
import { CommandBar } from "@/components/CommandBar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["owner", "manager", "advisor", "technician", "accountant"] },
  { href: "/dashboard/job-cards", label: "Job Cards", icon: ClipboardList, roles: ["owner", "manager", "advisor", "technician", "accountant"] },
  { href: "/dashboard/customers", label: "Customers", icon: Users, roles: ["owner", "manager", "advisor", "accountant"] },
  { href: "/dashboard/vehicles", label: "Vehicles", icon: Car, roles: ["owner", "manager", "advisor", "accountant"] },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package, roles: ["owner", "manager", "advisor"] },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt, roles: ["owner", "manager", "accountant"] },
  { href: "/dashboard/users", label: "Users & Roles", icon: UserCog, roles: ["owner", "manager"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, branchId, loading, roleResolved, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !roleResolved) return;
    if (role) return;
    (async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          role: "pending",
          branchId: "main",
          displayName: user.displayName ?? user.email ?? "",
          email: user.email ?? "",
          active: false,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    })();
  }, [user, role, roleResolved]);

  if (loading || !user || !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="animate-spin text-rosegold-400" size={28} />
      </div>
    );
  }

  if (!role || role === "pending" || role === "customer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="card max-w-md p-8 text-center shadow-luxe">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rosegold-sheen text-white shadow-luxe">
            <UserCog size={26} />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-burgundy-700">
            {role === "customer" ? "Customer portal coming soon" : "Waiting for access"}
          </h1>
          <p className="mt-2 font-sans text-sm text-ink-soft">
            {role === "customer"
              ? "Customer accounts will use a dedicated self-service portal in a later release."
              : "Your account is registered. An owner or manager needs to assign you a role before you can start. Ask them to open Users & Roles."}
          </p>
          <p className="mt-4 font-sans text-xs text-ink-faint">
            Signed in as {user.email}
          </p>
          <button onClick={() => logout()} className="btn-ghost mt-6">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter((n) => !role || n.roles.includes(role));
  const roleLabel = role ? ROLE_META[role].label : "No role assigned";

  return (
    <div className="flex min-h-screen bg-canvas">
      <CommandBar />
      <aside className="relative hidden w-72 flex-col border-r border-line bg-white lg:flex">
        <div className="relative flex items-center gap-3 px-6 py-7">
          <div className="icon-tile-gradient flex h-9 w-9 items-center justify-center rounded-lg">
            <span className="text-base font-semibold text-white">B</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold leading-none tracking-tight text-ink">
              Belt-Kit
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Garage ERP
            </p>
          </div>
        </div>

        <div className="relative px-4 pb-3">
          <button
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true })
              )
            }
            className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-muted/60 px-3 py-2.5 text-sm text-ink-faint transition-colors duration-150 hover:border-burgundy-200 hover:text-burgundy-600"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="flex items-center gap-0.5 rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium">
              <Command size={9} />K
            </kbd>
          </button>
        </div>

        <p className="relative px-7 pb-2 pt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          Menu
        </p>
        <nav className="relative flex-1 space-y-1.5 px-4">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-4 py-2.5 font-sans text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-burgundy-50 font-semibold text-burgundy-700"
                    : "text-ink-soft hover:bg-surface-muted hover:text-ink"
                }`}
              >
                {active && (
                  <span className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-burgundy-600" />
                )}
                <Icon
                  size={18}
                  className={active ? "text-burgundy-600" : "text-ink-faint group-hover:text-ink-soft"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted/70 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-burgundy-600 text-sm font-semibold text-white">
              {(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-sm font-medium text-ink">
                {user.displayName ?? user.email}
              </p>
              <p className="truncate font-sans text-xs text-ink-faint">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 font-sans text-sm text-ink-soft transition-colors duration-150 hover:border-burgundy-200 hover:text-burgundy-700"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-4 lg:hidden">
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Belt-Kit
          </span>
          <button
            onClick={() => logout()}
            className="text-ink-soft hover:text-burgundy-600"
          >
            <LogOut size={18} />
          </button>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 px-6 py-8 lg:px-10 lg:py-10"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
