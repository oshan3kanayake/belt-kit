"use client";

import { useCallback, useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { PaymentForm } from "./components/PaymentForm";
import { PurchaseOrderForm } from "./components/PurchaseOrderForm";
import { SupplierForm } from "./components/SupplierForm";
import { SupplierSummary } from "./components/SupplierSummary";
import { SupplierTable } from "./components/SupplierTable";
import supplierService from "./services/supplierService";
import type { Supplier } from "./types/supplierTypes";

export default function SuppliersPage() {
  const { role } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const authorized = role === "owner" || role === "manager";

  const refreshSuppliers = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await supplierService.getSupplierList();
      setSuppliers(response.suppliers ?? []);
    } catch (loadError: unknown) {
      const message =
        (loadError as { message?: string })?.message ?? "Could not load suppliers.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  useEffect(() => {
    void refreshSuppliers();
  }, [refreshSuppliers]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Purchasing" title="Suppliers" icon={Truck} />

      {!authorized ? (
        <EmptyState
          title="Not authorized"
          hint="Only owners and managers can access supplier management."
        />
      ) : (
        <div className="space-y-6">
          <SupplierForm onCreated={refreshSuppliers} />

          <section className="space-y-3" aria-labelledby="supplier-list-heading">
            <h2 id="supplier-list-heading" className="text-xl font-semibold text-ink">
              Supplier List
            </h2>
            <SupplierTable
              suppliers={suppliers}
              loading={loading}
              error={error}
              onSelectSupplier={(supplier) => {
                setSelectedSupplierId(supplier.id);
                document
                  .getElementById("supplier-summary")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </section>

          <section aria-label="Purchase Orders">
            <PurchaseOrderForm suppliers={suppliers} />
          </section>

          <section aria-label="Supplier Payments">
            <PaymentForm suppliers={suppliers} />
          </section>

          <section id="supplier-summary" aria-label="Supplier Summary" className="scroll-mt-6">
            <SupplierSummary
              key={selectedSupplierId}
              suppliers={suppliers}
              selectedSupplierId={selectedSupplierId}
            />
          </section>
        </div>
      )}
    </div>
  );
}
