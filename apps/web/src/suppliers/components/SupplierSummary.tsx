"use client";

import { useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { Field, EmptyState, useToast } from "@/components/ui";
import supplierService from "../services/supplierService";
import type { Supplier } from "../types/supplierTypes";

type SupplierSummaryProps = {
  suppliers: Supplier[];
  selectedSupplierId?: string;
};

export function SupplierSummary({ suppliers, selectedSupplierId = "" }: SupplierSummaryProps) {
  const { notify } = useToast();
  const [supplierId, setSupplierId] = useState(selectedSupplierId);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    supplierName?: string;
    totalPurchased: number;
    totalPaid: number;
    outstanding: number;
  } | null>(null);

  async function handleViewSummary() {
    if (!supplierId) {
      notify("Select a supplier to view the summary.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await supplierService.getSupplierSummary(supplierId);
      setSummary({
        supplierName: response.supplierName,
        totalPurchased: response.totalPurchased ?? 0,
        totalPaid: response.totalPaid ?? 0,
        outstanding: response.outstanding ?? 0,
      });
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? "Could not load supplier summary.";
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
        <BarChart3 size={18} />
        <h3 className="text-lg font-semibold text-ink">Supplier Summary</h3>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Field label="Supplier" required>
            <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="input-luxe">
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button type="button" onClick={handleViewSummary} className="btn-primary inline-flex items-center gap-2" disabled={loading || suppliers.length === 0}>
          <Search size={16} />
          {loading ? "Loading…" : "View Summary"}
        </button>
      </div>

      {!summary ? (
        <div className="mt-4">
          <EmptyState title="No summary loaded" hint="Choose a supplier and view their purchase and payment activity." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <p className="text-sm text-ink-soft">Supplier Name</p>
            <p className="mt-1 text-lg font-semibold text-ink">{summary.supplierName ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <p className="text-sm text-ink-soft">Total Purchased</p>
            <p className="mt-1 text-lg font-semibold text-ink">Rs. {summary.totalPurchased.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <p className="text-sm text-ink-soft">Total Paid</p>
            <p className="mt-1 text-lg font-semibold text-ink">Rs. {summary.totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4 md:col-span-3">
            <p className="text-sm text-ink-soft">Outstanding Balance</p>
            <p className="mt-1 text-lg font-semibold text-ink">Rs. {summary.outstanding.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
