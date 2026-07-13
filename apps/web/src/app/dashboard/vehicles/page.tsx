"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Car, Plus, Search, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/useCollection";
import { createDoc, updateDocById, deleteDocById } from "@/lib/db-write";
import { Vehicle, Customer } from "@/lib/models";
import {
  PageHeader,
  Modal,
  Field,
  CenterSpinner,
  EmptyState,
  ConfirmDialog,
  useToast,
} from "@/components/ui";

function VehiclesInner() {
  const { branchId, role } = useAuth();
  const params = useSearchParams();
  const preselectCustomer = params.get("customer");

  const { data: vehicles, loading, error } = useCollection<Vehicle>("vehicles");
  const { data: customers } = useCollection<Customer>("customers");
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<(Vehicle & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = role === "owner" || role === "manager" || role === "advisor";
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function doDelete(id: string) {
    try {
      await deleteDocById("vehicles", id);
      notify("Vehicle deleted.");
    } catch {
      notify("Could not delete vehicle.", "error");
    }
  }

  useEffect(() => {
    if (preselectCustomer) {
      setEditing(null);
      setModalOpen(true);
    }
  }, [preselectCustomer]);

  const customerName = (cid: string) =>
    customers.find((c) => c.id === cid)?.displayName ?? "Unknown owner";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plateNumber?.toLowerCase().includes(q) ||
        v.make?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        customerName(v.customerId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, search, customers]);

  async function handleSave(form: FormData) {
    if (!branchId) return;
    setSaving(true);
    const payload = {
      customerId: String(form.get("customerId") || ""),
      plateNumber: String(form.get("plateNumber") || "").trim().toUpperCase(),
      make: String(form.get("make") || "").trim(),
      model: String(form.get("model") || "").trim(),
      year: form.get("year") ? Number(form.get("year")) : undefined,
      vin: String(form.get("vin") || "").trim() || undefined,
      engine: String(form.get("engine") || "").trim() || undefined,
    };
    if (!payload.customerId || !payload.plateNumber || !payload.make) {
      notify("Owner, plate and make are required.", "error");
      setSaving(false);
      return;
    }
    try {
      if (editing) {
        await updateDocById("vehicles", editing.id, payload);
        notify("Vehicle updated.");
      } else {
        await createDoc("vehicles", branchId, payload);
        notify("Vehicle added.");
      }
      setModalOpen(false);
    } catch {
      notify("Could not save vehicle.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Records"
        title="Vehicles"
        icon={Car}
        action={
          canEdit && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={18} /> New Vehicle
            </button>
          )
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate, make, model or owner…"
          className="input-luxe pl-11"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        <CenterSpinner label="Loading vehicles…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title={search ? "No matches" : "No vehicles yet"}
          hint={
            search ? "Try another search." : "Add a vehicle and link it to a customer."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
              className="card group p-5 transition-shadow hover:shadow-luxe"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-burgundy-500">
                  <Car size={20} />
                </div>
                <span className="rounded-lg bg-burgundy-deep px-2.5 py-1 font-sans text-xs font-semibold uppercase tracking-wider text-white">
                  {v.plateNumber}
                </span>
              </div>
              <p className="font-serif text-lg font-semibold text-ink">
                {v.make} {v.model}
              </p>
              <p className="font-sans text-sm text-ink-soft">
                {v.year ? `${v.year} · ` : ""}
                {customerName(v.customerId)}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditing(v);
                        setModalOpen(true);
                      }}
                      className="font-sans text-xs text-ink-soft transition hover:text-burgundy-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(v.id)}
                      className="text-ink-faint transition hover:text-burgundy-600"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <Link
                  href={`/dashboard/vehicles/${v.id}`}
                  className="flex items-center gap-1 font-sans text-xs text-burgundy-600 hover:text-burgundy-700"
                >
                  History <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Vehicle" : "New Vehicle"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <Field label="Owner (customer)" required>
            <select
              name="customerId"
              defaultValue={editing?.customerId ?? preselectCustomer ?? ""}
              className="input-luxe"
            >
              <option value="" disabled>
                Select a customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} · {c.phone}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plate number" required>
              <input
                name="plateNumber"
                defaultValue={editing?.plateNumber}
                className="input-luxe uppercase"
                placeholder="e.g. CAB-1234"
              />
            </Field>
            <Field label="Year">
              <input
                name="year"
                type="number"
                defaultValue={editing?.year}
                className="input-luxe"
                placeholder="2019"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Make" required>
              <input
                name="make"
                defaultValue={editing?.make}
                className="input-luxe"
                placeholder="Toyota"
              />
            </Field>
            <Field label="Model">
              <input
                name="model"
                defaultValue={editing?.model}
                className="input-luxe"
                placeholder="Aqua"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="VIN">
              <input
                name="vin"
                defaultValue={editing?.vin}
                className="input-luxe"
                placeholder="optional"
              />
            </Field>
            <Field label="Engine">
              <input
                name="engine"
                defaultValue={editing?.engine}
                className="input-luxe"
                placeholder="optional"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : editing ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && doDelete(deleteId)}
        title="Delete this vehicle?"
        message="This permanently deletes the vehicle. Its past job cards are kept for history. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />
    </div>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <VehiclesInner />
    </Suspense>
  );
}
