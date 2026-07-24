/**
 * Dependency-free invoice arithmetic shared by billing UI code.
 *
 * All monetary inputs and outputs use integer minor units (for example cents).
 * A fixed `discountValue` is therefore also expressed in minor units, while a
 * percentage `discountValue` is expressed as a percentage (for example 12.5).
 */

export type InvoiceDiscountType = "percent" | "fixed";

export interface InvoiceExtraCharge {
  description: string;
  amountMinor: number;
}

export interface InvoiceCalculationInput {
  /** Existing line-item subtotal, in minor units. */
  baseSubtotalMinor?: number | null;
  /** Optional on older invoices; missing charges are treated as an empty list. */
  extraCharges?: readonly InvoiceExtraCharge[] | null;
  /** Invalid or missing values fall back to `fixed`. */
  discountType?: InvoiceDiscountType | null;
  /** Minor units for `fixed`, percentage points for `percent`. */
  discountValue?: number | null;
  /** Missing or invalid tax rates are treated as zero. */
  taxRatePercent?: number | null;
}

export interface InvoiceCalculationResult {
  baseSubtotalMinor: number;
  extraCharges: InvoiceExtraCharge[];
  extraChargesTotalMinor: number;
  /** Base subtotal plus all extra charges, before discounts. */
  adjustedSubtotalMinor: number;
  discountType: InvoiceDiscountType;
  /** The normalized value used to calculate `discountMinor`. */
  discountValue: number;
  discountMinor: number;
  taxableSubtotalMinor: number;
  taxRatePercent: number;
  taxMinor: number;
  totalMinor: number;
}

export const DEFAULT_INVOICE_DISCOUNT_TYPE: InvoiceDiscountType = "fixed";

/**
 * Converts a runtime value to a non-negative, safe integer number of minor
 * units. This is exported so forms can normalize individual money inputs in
 * exactly the same way as the totals calculator.
 */
export function normalizeMinorUnits(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, Math.round(value));
}

/** Converts a runtime value to a non-negative finite rate. */
export function normalizeRatePercent(
  value: number | null | undefined
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, value);
}

/** Percentage discounts cannot be lower than zero or greater than 100. */
export function normalizeDiscountPercent(
  value: number | null | undefined
): number {
  return Math.min(100, normalizeRatePercent(value));
}

function addMinorUnits(left: number, right: number): number {
  if (left >= Number.MAX_SAFE_INTEGER - right) {
    return Number.MAX_SAFE_INTEGER;
  }

  return left + right;
}

function percentageOfMinorUnits(amountMinor: number, ratePercent: number): number {
  if (amountMinor === 0 || ratePercent === 0) return 0;

  const result = amountMinor * (ratePercent / 100);
  if (!Number.isFinite(result) || result >= Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.round(result);
}

function normalizeExtraCharges(
  charges: readonly InvoiceExtraCharge[] | null | undefined
): InvoiceExtraCharge[] {
  if (!Array.isArray(charges)) return [];

  return charges.map((charge) => ({
    description:
      typeof charge?.description === "string" ? charge.description.trim() : "",
    amountMinor: normalizeMinorUnits(charge?.amountMinor),
  }));
}

/**
 * Calculates an invoice total without mutating the supplied invoice data.
 * Every field is optional so invoices created before billing adjustments were
 * introduced can be passed directly after mapping their legacy subtotal.
 */
export function calculateInvoiceTotals(
  input: InvoiceCalculationInput = {}
): InvoiceCalculationResult {
  const baseSubtotalMinor = normalizeMinorUnits(input.baseSubtotalMinor);
  const extraCharges = normalizeExtraCharges(input.extraCharges);
  const extraChargesTotalMinor = extraCharges.reduce(
    (total, charge) => addMinorUnits(total, charge.amountMinor),
    0
  );
  const adjustedSubtotalMinor = addMinorUnits(
    baseSubtotalMinor,
    extraChargesTotalMinor
  );

  const discountType: InvoiceDiscountType =
    input.discountType === "percent" ? "percent" : DEFAULT_INVOICE_DISCOUNT_TYPE;
  const discountValue =
    discountType === "percent"
      ? normalizeDiscountPercent(input.discountValue)
      : normalizeMinorUnits(input.discountValue);
  const requestedDiscountMinor =
    discountType === "percent"
      ? percentageOfMinorUnits(adjustedSubtotalMinor, discountValue)
      : discountValue;
  const discountMinor = Math.min(
    adjustedSubtotalMinor,
    requestedDiscountMinor
  );
  const taxableSubtotalMinor = adjustedSubtotalMinor - discountMinor;

  const taxRatePercent = normalizeRatePercent(input.taxRatePercent);
  const taxMinor = percentageOfMinorUnits(
    taxableSubtotalMinor,
    taxRatePercent
  );
  const totalMinor = addMinorUnits(taxableSubtotalMinor, taxMinor);

  return {
    baseSubtotalMinor,
    extraCharges,
    extraChargesTotalMinor,
    adjustedSubtotalMinor,
    discountType,
    discountValue,
    discountMinor,
    taxableSubtotalMinor,
    taxRatePercent,
    taxMinor,
    totalMinor,
  };
}
