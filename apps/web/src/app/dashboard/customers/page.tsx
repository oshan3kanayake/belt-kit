"use client";

import { useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Plus, Search, Phone, Mail, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/useCollection";
import { createDoc, updateDocById, deleteDocById } from "@/lib/db-write";
import { Customer } from "@/lib/models";
import { initials } from "@/lib/format";
import {
  PageHeader,
  Modal,
  Field,
  CenterSpinner,
  EmptyState,
  Badge,
  ConfirmDialog,
  useToast,
} from "@/components/ui";

const CHANNELS = ["sms", "whatsapp", "email"] as const;
const SEGMENTS = ["walkin", "vip", "fleet"] as const;

export default function CustomersPage() {
  const { branchId, role } = useAuth();
  const { data: customers, loading, error } = useCollection<Customer>("customers");
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<(Customer & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canEdit = role === "owner" || role === "manager" || role === "advisor";

  async function doDelete(id: string) {
    try {
      // Delete the customer and cascade-delete their vehicles. Job cards are
      // KEPT for history (they'll just show no linked owner).
      const vehSnap = await getDocs(
        query(collection(db, "vehicles"), where("customerId", "==", id))
      );
      await Promise.all(
        vehSnap.docs.map((d) => deleteDocById("vehicles", d.id))
      );
      await deleteDocById("customers", id);
      notify("Customer and their vehicles deleted.");
    } catch {
      notify("Could not delete customer.", "error");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.displayName?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(c: Customer & { id: string }) {
    setEditing(c);
    setModalOpen(true);
  }

  async function handleSave(form: FormData) {
    if (!branchId) return;
    setSaving(true);
    const payload = {
      displayName: String(form.get("displayName") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || "").trim() || undefined,
      preferredChannel: String(form.get("preferredChannel") || "sms"),
      segment: String(form.get("segment") || "walkin"),
    };
    if (!payload.displayName || !payload.phone) {
      notify("Name and phone are required.", "error");
      setSaving(false);
      return;
    }
    try {
      if (editing) {
        await updateDocById("customers", editing.id, payload);
        notify("Customer updated.");
      } else {
        await createDoc("customers", branchId, payload);
        notify("Customer added.");
      }
      setModalOpen(false);
    } catch {
      notify("Could not save. Check permissions / rules.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        icon={Users}
        action={
          canEdit && (
            <button onClick={openNew} className="btn-primary">
              <Plus size={18} /> New Customer
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
          placeholder="Search name, phone or email…"
          className="input-luxe pl-11"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        <CenterSpinner label="Loading customers…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matches" : "No customers yet"}
          hint={
            search
              ? "Try a different search term."
              : "Add your first customer to start building service history."
          }
          action={
            canEdit &&
            !search && (
              <button onClick={openNew} className="btn-primary">
                <Plus size={18} /> New Customer
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
              className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-luxe"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rosegold-sheen font-sans text-sm font-semibold text-white">
                {initials(c.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-sans font-medium text-ink">
                    {c.displayName}
                  </p>
                  {c.segment && c.segment !== "walkin" && (
                    <Badge tone={c.segment === "vip" ? "gold" : "blue"}>
                      {c.segment.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 font-sans text-xs text-ink-soft">
                  <span className="flex items-center gap-1">
                    <Phone size={12} /> {c.phone}
                  </span>
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {c.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && (
                  <>
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-lg px-2.5 py-1.5 font-sans text-xs text-ink-soft transition hover:bg-surface-muted hover:text-burgundy-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="rounded-lg p-2 text-ink-faint transition hover:bg-surface-muted hover:text-burgundy-600"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <Link
                  href={`/dashboard/customers/${c.id}`}
                  className="rounded-lg p-2 text-ink-faint transition hover:bg-surface-muted hover:text-burgundy-600"
                  aria-label="View"
                >
                  <ChevronRight size={18} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Customer" : "New Customer"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <Field label="Full name" required>
            <input
              name="displayName"
              defaultValue={editing?.displayName}
              className="input-luxe"
              placeholder="e.g. Nimal Perera"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" required>
              <input
                name="phone"
                defaultValue={editing?.phone}
                className="input-luxe"
                placeholder="07X XXX XXXX"
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                defaultValue={editing?.email}
                className="input-luxe"
                placeholder="optional"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Preferred channel">
              <select
                name="preferredChannel"
                defaultValue={editing?.preferredChannel ?? "sms"}
                className="input-luxe"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch === "sms" ? "SMS" : ch === "whatsapp" ? "WhatsApp" : "Email"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Segment">
              <select
                name="segment"
                defaultValue={editing?.segment ?? "walkin"}
                className="input-luxe"
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s === "walkin" ? "Walk-in" : s.toUpperCase()}
                  </option>
                ))}
              </select>
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
              {saving ? "Saving…" : editing ? "Save changes" : "Add customer"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && doDelete(deleteId)}
        title="Delete this customer?"
        message="This permanently deletes the customer and all their vehicles. Their past job cards are kept for history. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />
    </div>
  );
}
