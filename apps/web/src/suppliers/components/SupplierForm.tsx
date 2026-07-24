"use client";

import { useState } from "react";
import { Building2, Save } from "lucide-react";
import { Field, useToast } from "@/components/ui";
import supplierService from "../services/supplierService";

type SupplierFormProps = {
  onCreated?: () => void;
};

export function SupplierForm({ onCreated }: SupplierFormProps) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      notify("Supplier name is required.", "error");
      return;
    }

    setSaving(true);
    try {
      await supplierService.createSupplier({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      notify("Supplier registered successfully.", "success");
      setName("");
      setPhone("");
      setEmail("");
      onCreated?.();
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message ?? "Could not register supplier.";
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
        <Building2 size={18} />
        <h3 className="text-lg font-semibold text-ink">Register Supplier</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Supplier Name" required>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Northline Auto Parts"
            className="input-luxe"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Phone">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0712 345678"
              className="input-luxe"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="supplier@example.com"
              className="input-luxe"
            />
          </Field>
        </div>

        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save size={16} />
          {saving ? "Registering…" : "Register Supplier"}
        </button>
      </form>
    </div>
  );
}
