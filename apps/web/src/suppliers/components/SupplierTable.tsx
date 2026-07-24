"use client";

import { Eye, Package2, Phone, Mail } from "lucide-react";
import { CenterSpinner, EmptyState } from "@/components/ui";
import type { Supplier } from "../types/supplierTypes";

type SupplierTableProps = {
  suppliers: Supplier[];
  loading?: boolean;
  error?: string | null;
  onSelectSupplier?: (supplier: Supplier) => void;
};

export function SupplierTable({ suppliers, loading, error, onSelectSupplier }: SupplierTableProps) {
  if (loading) {
    return <CenterSpinner label="Loading suppliers" />;
  }

  if (error) {
    return <EmptyState title="Could not load suppliers" hint={error} />;
  }

  if (suppliers.length === 0) {
    return <EmptyState title="No suppliers yet" hint="Register your first supplier to begin tracking purchases and payments." />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted/70 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-semibold">Supplier Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Branch</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="bg-white">
                <td className="px-4 py-3 text-ink">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
                      <Package2 size={15} />
                    </div>
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {supplier.phone ? (
                    <span className="inline-flex items-center gap-2">
                      <Phone size={14} />
                      {supplier.phone}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {supplier.email ? (
                    <span className="inline-flex items-center gap-2">
                      <Mail size={14} />
                      {supplier.email}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">{supplier.branchId ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectSupplier?.(supplier)}
                    className="btn-ghost inline-flex items-center gap-2"
                  >
                    <Eye size={14} />
                    View summary
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
