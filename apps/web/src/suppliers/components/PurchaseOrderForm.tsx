"use client";

import { useMemo, useState } from "react";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { Field, useToast } from "@/components/ui";
import supplierService from "../services/supplierService";
import type { PurchaseOrderItem, Supplier } from "../types/supplierTypes";

type PurchaseOrderFormProps = {
  suppliers: Supplier[];
  onCreated?: () => void;
};

function getDefaultDate() {
  const today = new Date();
  return `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
}

export function PurchaseOrderForm({ suppliers, onCreated }: PurchaseOrderFormProps) {
  const { notify } = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(getDefaultDate());
  const [items, setItems] = useState<PurchaseOrderItem[]>([{ name: "", quantity: 1, cost: 0 }]);
  const [saving, setSaving] = useState(false);

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.cost, 0), [items]);

  function updateItem(index: number, updates: Partial<PurchaseOrderItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)));
  }

  function addItem() {
    setItems((current) => [...current, { name: "", quantity: 1, cost: 0 }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supplierId) {
      notify("Select a supplier before creating a purchase order.", "error");
      return;
    }

    const normalizedItems = items.filter((item) => item.name.trim());
    if (normalizedItems.length === 0) {
      notify("Add at least one item to the purchase order.", "error");
      return;
    }

    const invalid = normalizedItems.some((item) => Number.isNaN(item.quantity) || Number.isNaN(item.cost) || item.quantity <= 0 || item.cost < 0);
    if (invalid) {
      notify("Enter valid quantities and costs for each item.", "error");
      return;
    }

    setSaving(true);
    try {
      await supplierService.createPurchaseOrder({
        supplierId,
        orderDate,
        items: normalizedItems.map((item) => ({
          name: item.name.trim(),
          quantity: Number(item.quantity),
          cost: Number(item.cost),
        })),
      });
      notify("Purchase order created.", "success");
      setSupplierId("");
      setOrderDate(getDefaultDate());
      setItems([{ name: "", quantity: 1, cost: 0 }]);
      onCreated?.();
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? "Could not create purchase order.";
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
        <ReceiptText size={18} />
        <h3 className="text-lg font-semibold text-ink">Create Purchase Order</h3>
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

          <Field label="Order Date" required>
            <input required type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} className="input-luxe" />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Items</p>
            <button type="button" onClick={addItem} className="btn-ghost inline-flex items-center gap-2">
              <Plus size={14} /> Add item
            </button>
          </div>

          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="grid gap-3 rounded-xl border border-line bg-surface-muted/40 p-3 md:grid-cols-[1.6fr_0.8fr_0.8fr_auto]">
              <Field label="Item name">
                <input
                  value={item.name}
                  required
                  onChange={(event) => updateItem(index, { name: event.target.value })}
                  placeholder="Brake Pad"
                  className="input-luxe"
                />
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 0 })}
                  className="input-luxe"
                />
              </Field>
              <Field label="Cost">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.cost}
                  onChange={(event) => updateItem(index, { cost: Number(event.target.value) || 0 })}
                  className="input-luxe"
                />
              </Field>
              <div className="flex items-end">
                <button type="button" onClick={() => removeItem(index)} className="btn-ghost inline-flex items-center gap-2" disabled={items.length === 1}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-burgundy-50/60 p-3 text-sm text-ink">
          <span className="font-semibold">Total Amount:</span> Rs. {totalAmount.toLocaleString()}
        </div>

        <button type="submit" className="btn-primary" disabled={saving || suppliers.length === 0}>
          {saving ? "Creating…" : "Create Purchase Order"}
        </button>
      </form>
    </div>
  );
}
