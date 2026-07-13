import { Role } from "./auth-context";

/** Human-friendly labels + descriptions for each role, from the spec matrix. */
export const ROLE_META: Record<
  Role,
  { label: string; blurb: string; accent: string }
> = {
  owner: {
    label: "Owner / Admin",
    blurb: "Full access across all branches.",
    accent: "burgundy",
  },
  manager: {
    label: "Branch Manager",
    blurb: "Full control within their branch.",
    accent: "burgundy",
  },
  advisor: {
    label: "Front Desk",
    blurb: "Front desk — customers, jobs, invoices, payments, staff.",
    accent: "burgundy",
  },
  technician: {
    label: "Technician",
    blurb: "Assigned jobs; update status only.",
    accent: "rosegold",
  },
  accountant: {
    label: "Accountant / Cashier",
    blurb: "Invoices & payments. No job editing.",
    accent: "rosegold",
  },
  customer: {
    label: "Customer (Portal)",
    blurb: "Own jobs & invoices; pay online.",
    accent: "rosegold",
  },
  pending: {
    label: "Pending",
    blurb: "Awaiting role assignment.",
    accent: "rosegold",
  },
};

/** The default seeded staff accounts (created by scripts/seed.mjs). */
export const DEFAULT_ACCOUNTS: {
  role: Role;
  email: string;
  displayName: string;
}[] = [
  { role: "owner", email: "owner@beltkit.local", displayName: "Workshop Owner" },
  { role: "manager", email: "manager@beltkit.local", displayName: "Branch Manager" },
  { role: "advisor", email: "advisor@beltkit.local", displayName: "Service Advisor" },
  { role: "technician", email: "tech@beltkit.local", displayName: "Lead Technician" },
  { role: "accountant", email: "accounts@beltkit.local", displayName: "Cashier" },
];

/** Shared demo password for every seeded account (change in production!). */
export const DEMO_PASSWORD = "beltkit123";
