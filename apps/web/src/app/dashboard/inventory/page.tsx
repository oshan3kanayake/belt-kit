"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/useCollection";
import { createDoc, updateDocById, deleteDocById } from "@/lib/db-write";
import { Part } from "@/lib/models";
import { canManageInventory } from "@/lib/permissions";
import { formatMoney, toMinor } from "@/lib/format";
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

export default function InventoryPage() {
  const { branchId, role } = useAuth();
  const { data: parts, loading, error } = useCollection<Part>("parts");
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<(Part & { id: string }) | null>(null);
  const [stockPart, setStockPart] = useState<(Part & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = canManageInventory(role);

  const filtered = useMemo(() => {
    let rows = parts;
    const q = search.toLowerCase().trim();
    if (q)
      rows = rows.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      );
    if (onlyLow) rows = rows.filter((p) => p.lowStock);
    return rows;
  }, [parts, search, onlyLow]);

  const lowCount = parts.filter((p) => p.lowStock).length;

  async function handleSave(form: FormData) {
    if (!branchId) return;
    setSaving(true);
    const quantityOnHand = Number(form.get("quantityOnHand") || 0);
    const reorderThreshold = Number(form.get("reorderThreshold") || 0);
    const payload = {
      sku: String(form.get("sku") || "").trim(),
      name: String(form.get("name") || "").trim(),
      costPriceMinor: toMinor(String(form.get("cost") || "0")),
      sellPriceMinor: toMinor(String(form.get("sell") || "0")),
      quantityOnHand,
      reorderThreshold,
      lowStock: quantityOnHand <= reorderThreshold,
      binLocation: String(form.get("bin") || "").trim() || undefined,
    };
    if (!payload.name || !payload.sku) {
      notify("Name and SKU are required.", "error");
      setSaving(false);
      return;
    }
    try {
      if (editing) {
        await updateDocById("parts", editing.id, payload);
        notify("Part updated.");
      } else {
        await createDoc("parts", branchId, payload);
        notify("Part added.");
      }
      setModalOpen(false);
    } catch {
      notify("Could not save part.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(form: FormData) {
    if (!stockPart) return;
    const delta = Number(form.get("delta") || 0);
    const newQty = Math.max(0, stockPart.quantityOnHand + delta);
    try {
      await updateDocById("parts", stockPart.id, {
        quantityOnHand: newQty,
        lowStock: newQty <= stockPart.reorderThreshold,
      });
      await createDoc("stockMovements", stockPart.branchId, {
        partId: stockPart.id,
        delta,
        reason: delta < 0 ? "adjustment" : "purchase",
        jobCardId: null,
      });
      notify("Stock updated.");
      setStockPart(null);
    } catch {
      notify("Could not adjust stock.", "error");
    }
  }

  async function doDelete(id: string) {
    try {
      await deleteDocById("parts", id);
      notify("Part deleted.");
    } catch {
      notify("Could not delete part.", "error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Stock"
        title="Inventory"
        icon={Package}
        action={
          canEdit && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={18} /> New Part
            </button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="input-luxe pl-11"
          />
        </div>
        <button
          onClick={() => setOnlyLow((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 font-sans text-sm transition ${
            onlyLow
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-line bg-surface text-ink-soft hover:text-burgundy-600"
          }`}
        >
          <AlertTriangle size={16} />
          Low stock {lowCount > 0 && `(${lowCount})`}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        <CenterSpinner label="Loading parts…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || onlyLow ? "No matches" : "No parts yet"}
          hint={
            search || onlyLow
              ? "Adjust your filters."
              : "Add parts to your catalogue so they can be used on job cards."
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-5 py-3">Part</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Sell</th>
                <th className="px-5 py-3 text-center">In stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="bg-surface transition hover:bg-surface-muted/40"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      {p.name}
                      {p.lowStock && (
                        <Badge tone="amber">
                          <AlertTriangle size={11} /> Low
                        </Badge>
                      )}
                    </span>
                    {p.binLocation && (
                      <span className="font-sans text-xs text-ink-faint">
                        Bin {p.binLocation}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{p.sku}</td>
                  <td className="px-5 py-3 text-right text-ink-soft">
                    {formatMoney(p.costPriceMinor)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-ink">
                    {formatMoney(p.sellPriceMinor)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`font-semibold ${
                        p.lowStock ? "text-amber-600" : "text-ink"
                      }`}
                    >
                      {p.quantityOnHand}
                    </span>
                    <span className="text-ink-faint"> / {p.reorderThreshold}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setStockPart(p)}
                          className="rounded-lg px-2 py-1 font-sans text-xs text-ink-soft transition hover:bg-surface-muted hover:text-burgundy-600"
                        >
                          Stock
                        </button>
                        <button
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-ink-faint transition hover:text-burgundy-600"
                          aria-label="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="rounded-lg p-1.5 text-ink-faint transition hover:text-burgundy-600"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Part" : "New Part"}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Part name" required>
              <input
                name="name"
                defaultValue={editing?.name}
                className="input-luxe"
                placeholder="Oil filter"
              />
            </Field>
            <Field label="SKU" required>
              <input
                name="sku"
                defaultValue={editing?.sku}
                className="input-luxe"
                placeholder="OF-1023"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cost price (LKR)">
              <input
                name="cost"
                defaultValue={editing ? (editing.costPriceMinor / 100).toString() : ""}
                className="input-luxe"
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Sell price (LKR)">
              <input
                name="sell"
                defaultValue={editing ? (editing.sellPriceMinor / 100).toString() : ""}
                className="input-luxe"
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Qty on hand">
              <input
                name="quantityOnHand"
                type="number"
                min={0}
                defaultValue={editing?.quantityOnHand ?? 0}
                className="input-luxe"
              />
            </Field>
            <Field label="Reorder at">
              <input
                name="reorderThreshold"
                type="number"
                min={0}
                defaultValue={editing?.reorderThreshold ?? 0}
                className="input-luxe"
              />
            </Field>
            <Field label="Bin location">
              <input
                name="bin"
                defaultValue={editing?.binLocation}
                className="input-luxe"
                placeholder="A-12"
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
              {saving ? "Saving…" : editing ? "Save changes" : "Add part"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!stockPart}
        onClose={() => setStockPart(null)}
        title={`Adjust stock — ${stockPart?.name ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adjustStock(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <p className="font-sans text-sm text-ink-soft">
            Current stock:{" "}
            <span className="font-semibold text-ink">
              {stockPart?.quantityOnHand}
            </span>
          </p>
          <Field
            label="Change (use a negative number to remove)"
            required
            hint="e.g. 10 to receive stock, -2 to write off."
          >
            <input name="delta" type="number" className="input-luxe" placeholder="10" />
          </Field>
          <div className="flex justify-between gap-3 pt-2">
            <div className="flex gap-2 text-ink-faint">
              <TrendingUp size={18} className="text-emerald-500" />
              <TrendingDown size={18} className="text-burgundy-400" />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStockPart(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Apply
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && doDelete(deleteId)}
        title="Delete this part?"
        message="This permanently removes the part from your catalogue. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />
    </div>
  );
}
