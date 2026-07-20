/** Client-side model types (mirror of functions/src/types.ts). */
import { Timestamp } from "firebase/firestore";

export interface Branch {
  name: string;
  currency: string;
  taxRatePercent: number;
  timezone: string;
  archived?: boolean;
}

export interface Customer {
  branchId: string;
  displayName: string;
  phone: string;
  email?: string;
  preferredChannel: "sms" | "whatsapp" | "email";
  segment?: "vip" | "fleet" | "walkin";
  archived?: boolean;
  createdAt?: Timestamp;
}

export interface Vehicle {
  branchId: string;
  customerId: string;
  plateNumber: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  engine?: string;
  archived?: boolean;
  createdAt?: Timestamp;
}

export type JobStatus =
  | "booked"
  | "in_progress"
  | "awaiting_parts"
  | "qc"
  | "ready"
  | "delivered";

export interface JobCard {
  branchId: string;
  customerId: string;
  vehicleId: string;
  complaint: string;
  status: JobStatus;
  assignedTechnicianIds: string[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  invoiceId?: string | null;
  /** Optional planned service date (for the dashboard calendar). */
  scheduledDate?: Timestamp | null;
  archived?: boolean;
  createdAt?: Timestamp;
}

export interface JobCardLine {
  branchId: string;
  jobCardId: string;
  kind: "labor" | "part";
  description: string;
  partId?: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  archived?: boolean;
  createdAt?: Timestamp;
}

export interface Part {
  branchId: string;
  sku: string;
  name: string;
  costPriceMinor: number;
  sellPriceMinor: number;
  quantityOnHand: number;
  reorderThreshold: number;
  lowStock: boolean;
  binLocation?: string;
  archived?: boolean;
  createdAt?: Timestamp;
}

export type InvoiceStatus = "draft" | "issued" | "part_paid" | "paid" | "void";

export type DiscountType = "percent" | "fixed";

export interface ExtraCharge {
  description: string;
  amountMinor: number;
}

export interface Invoice {
  branchId: string;
  jobCardId: string;
  customerId: string;
  status: InvoiceStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  /** Tax percentage frozen when the invoice is created. */
  taxRatePercent?: number;
  /** Optional manual charges and discount. Missing on legacy invoices. */
  extraCharges?: ExtraCharge[];
  discountType?: DiscountType;
  /** Percentage points for percent discounts; minor units for fixed discounts. */
  discountValue?: number;
  discountMinor?: number;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    kind?: "labor" | "part";
    partId?: string | null;
    /** Part cost frozen at invoice time for stable profit reporting. */
    costPriceMinor?: number;
  }>;
  archived?: boolean;
  createdAt?: Timestamp;
}

export interface Payment {
  branchId: string;
  invoiceId: string;
  customerId: string;
  amountMinor: number;
  method: "cash" | "card" | "bank_transfer" | "wallet";
  reference?: string;
  /** Safe display metadata only. Full card details and CVV are never stored. */
  cardLast4?: string;
  provider?: string;
  createdAt?: Timestamp;
}

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; tone: "neutral" | "blue" | "amber" | "gold" | "green" | "burgundy" }
> = {
  booked: { label: "Booked", tone: "neutral" },
  in_progress: { label: "In Progress", tone: "blue" },
  awaiting_parts: { label: "Awaiting Parts", tone: "amber" },
  qc: { label: "Quality Check", tone: "gold" },
  ready: { label: "Ready", tone: "green" },
  delivered: { label: "Delivered", tone: "burgundy" },
};

export const JOB_STATUS_ORDER: JobStatus[] = [
  "booked",
  "in_progress",
  "awaiting_parts",
  "qc",
  "ready",
  "delivered",
];
