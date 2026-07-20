/**
 * BELT-KIT — Firestore Data Model (Phase 1 MVP)
 * ----------------------------------------------------------------------------
 * These TypeScript interfaces ARE your database schema. Firestore is
 * schema-less, so this file is the single source of truth for what shape each
 * document has. Every collection below maps to a top-level Firestore
 * collection of the same name.
 *
 * Spec rules encoded here:
 *   - Every business record carries `branchId` (multi-branch safe from day 1).
 *   - No hard deletes: records carry `archived` instead.
 *   - Money is stored as integer minor units (e.g. cents) to avoid float bugs.
 *   - Line items store the price AT THE TIME (`unitPriceMinor`) so old invoices
 *     never change when the catalogue price changes later.
 *   - Financial/status changes get an AuditLogEntry (written by a Function).
 */

import { Timestamp } from "firebase-admin/firestore";

/** The fixed set of roles from the spec's permission matrix. */
export type Role =
  | "owner"
  | "manager"
  | "advisor"
  | "technician"
  | "accountant"
  | "customer";

/** Fields every business document shares. */
export interface BaseDoc {
  branchId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  archived: boolean; // soft-delete flag — we never hard-delete
}

// ---- Branches --------------------------------------------------------------
export interface Branch {
  name: string;
  currency: string; // ISO 4217, e.g. "LKR", "GBP", "INR"
  taxRatePercent: number; // default VAT/GST rate for this branch
  timezone: string; // e.g. "Asia/Colombo"
  createdAt: Timestamp;
  archived: boolean;
}

// ---- Users / staff ---------------------------------------------------------
// The authoritative role lives in Firebase Auth custom claims (set by a
// Function). This mirror doc exists so staff lists are queryable in Firestore.
export interface UserProfile {
  branchId: string;
  role: Role;
  displayName: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: Timestamp;
}

// ---- Customers (CRM) -------------------------------------------------------
export interface Customer extends BaseDoc {
  displayName: string;
  phone: string;
  email?: string;
  preferredChannel: "sms" | "whatsapp" | "email";
  segment?: "vip" | "fleet" | "walkin";
  // Optional link to a portal login (Firebase Auth uid) if the customer has one.
  portalUid?: string | null;
}

// ---- Vehicles --------------------------------------------------------------
export interface Vehicle extends BaseDoc {
  customerId: string;
  plateNumber: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  engine?: string;
}

// ---- Job Cards / Repair Orders --------------------------------------------
export type JobStatus =
  | "booked"
  | "in_progress"
  | "awaiting_parts"
  | "qc"
  | "ready"
  | "delivered";

export interface JobCard extends BaseDoc {
  customerId: string;
  vehicleId: string;
  complaint: string; // what the customer reported
  status: JobStatus;
  assignedTechnicianIds: string[]; // Auth uids of assigned technicians
  // Rolled-up totals in minor units, kept in sync when lines change.
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  invoiceId?: string | null; // set once an invoice is generated
}

/** A single labor or parts line on a job card. */
export interface JobCardLine extends BaseDoc {
  jobCardId: string;
  kind: "labor" | "part";
  description: string;
  partId?: string | null; // set when kind === "part"
  quantity: number;
  // Price captured at the moment the line was added — never re-read live.
  unitPriceMinor: number;
  lineTotalMinor: number; // quantity * unitPriceMinor
}

// ---- Inventory -------------------------------------------------------------
export interface Part extends BaseDoc {
  sku: string;
  name: string;
  costPriceMinor: number;
  sellPriceMinor: number;
  quantityOnHand: number;
  reorderThreshold: number;
  lowStock: boolean; // derived: quantityOnHand <= reorderThreshold
  binLocation?: string;
}

/** Append-only record of stock going in or out. */
export interface StockMovement extends BaseDoc {
  partId: string;
  delta: number; // negative = used/sold, positive = received
  reason: "job_use" | "purchase" | "adjustment" | "return";
  jobCardId?: string | null;
}

// ---- Billing ---------------------------------------------------------------
export type InvoiceStatus = "draft" | "issued" | "part_paid" | "paid" | "void";

export interface Invoice extends BaseDoc {
  jobCardId: string;
  customerId: string;
  customerUid?: string | null; // for portal read access, if customer has login
  status: InvoiceStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  // Snapshot of the lines at invoice time so history is frozen.
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
}

export interface Payment extends BaseDoc {
  invoiceId: string;
  customerId: string;
  customerUid?: string | null;
  amountMinor: number;
  method: "cash" | "card" | "bank_transfer" | "wallet";
  reference?: string;
}

// ---- Audit log -------------------------------------------------------------
export interface AuditLogEntry {
  branchId: string;
  actorUid: string; // who did it
  action: string; // e.g. "invoice.created", "jobCard.status_changed"
  entityType: string; // "invoice" | "jobCard" | "payment" | "part" ...
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  at: Timestamp;
}

// ---- Employee Payments -----------------------------------------------------

export interface EmployeePayment {
    employeeId: string;
    branchId: string;

    month: string; 
    // Example: "2026-07"

    amountPaidMinor: number;

    paidDate: string;

    createdBy: string;
}