"use client";

import { useState } from "react";
import { CreditCard, Save } from "lucide-react";
import { Field, useToast } from "@/components/ui";
import supplierService from "../services/supplierService";
import type { Supplier } from "../types/supplierTypes";

type PaymentFormProps = {
  suppliers: Supplier[];
  onCreated?: () => void;
};

function getDefaultDate() {
  const today = new Date();
  return `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
}

export function PaymentForm({ suppliers, onCreated }: PaymentFormProps) {
  const { notify } = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getDefaultDate());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supplierId) {
      notify("Select a supplier before recording a payment.", "error");
      return;
    }

    const value = Number(amount);
    if (!value || value <= 0) {
      notify("Enter a valid payment amount.", "error");
      return;
    }

    setSaving(true);
    try {
      await supplierService.createSupplierPayment({
        supplierId,
        amount: value,
        paymentDate,
        note: note.trim(),
      });
      notify("Payment recorded successfully.", "success");
      setSupplierId("");
      setAmount("");
      setPaymentDate(getDefaultDate());
      setNote("");
      onCreated?.();
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? "Could not record payment.";
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
        <CreditCard size={18} />
        <h3 className="text-lg font-semibold text-ink">Record Payment</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
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

          <Field label="Amount" required>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="input-luxe" />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Payment Date" required>
            <input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="input-luxe" />
          </Field>

          <Field label="Note">
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className="input-luxe" />
          </Field>
        </div>

        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving || suppliers.length === 0}>
          <Save size={16} />
          {saving ? "Recording…" : "Record Payment"}
        </button>
      </form>
    </div>
  );
}
