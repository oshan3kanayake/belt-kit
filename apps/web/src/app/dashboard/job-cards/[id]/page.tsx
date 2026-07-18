"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, onSnapshot, collection, getDocs, query, where as fsWhere } from "firebase/firestore";
import { generateInvoiceClient } from "@/lib/invoice";
import {
  ArrowLeft,
  Car,
  User,
  Users,
  Plus,
  Trash2,
  Wrench,
  Package,
  Receipt,
  Check,
  ArrowRight,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCollection, where } from "@/lib/useCollection";
import { createDoc, updateDocById, deleteDocById } from "@/lib/db-write";
import {
  JobCard,
  Customer,
  Vehicle,
  JobCardLine,
  Part,
  JobStatus,
  JOB_STATUS_META,
  JOB_STATUS_ORDER,
} from "@/lib/models";
import { formatMoney, toMinor } from "@/lib/format";
import {
  CenterSpinner,
  EmptyState,
  Badge,
  Modal,
  Field,
  ConfirmDialog,
  useToast,
} from "@/components/ui";

const BRANCH_TAX_PERCENT = 18;

export default function JobCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const { notify } = useToast();

  const [job, setJob] = useState<JobCard | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: lines } = useCollection<JobCardLine>("jobCardLines", [
    where("jobCardId", "==", id),
  ]);
  const { data: parts } = useCollection<Part>("parts");

  const [lineModal, setLineModal] = useState(false);
  const [lineKind, setLineKind] = useState<"labor" | "part">("labor");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [technicians, setTechnicians] = useState<{ uid: string; name: string }[]>([]);

  useEffect(() => {
    if (role !== "owner" && role !== "manager" && role !== "advisor") return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), fsWhere("role", "==", "technician"))
        );
        setTechnicians(
          snap.docs.map((d) => ({
            uid: d.id,
            name: (d.data().displayName as string) || (d.data().email as string) || d.id,
          }))
        );
      } catch {
        /* ignore */
      }
    })();
  }, [role]);

  async function toggleTechnician(uid: string) {
    if (!job) return;
    const current = job.assignedTechnicianIds || [];
    const next = current.includes(uid)
      ? current.filter((x) => x !== uid)
      : [...current, uid];
    try {
      await updateDocById("jobCards", id, { assignedTechnicianIds: next });
      notify("Technician assignment updated.");
    } catch {
      notify("Could not update assignment.", "error");
    }
  }

  async function deleteJob() {
    try {
      await deleteDocById("jobCards", id);
      notify("Job card deleted.");
      router.push("/dashboard/job-cards");
    } catch {
      notify("Could not delete job card.", "error");
    }
  }

  const canEditJob = role === "owner" || role === "manager" || role === "advisor";
  const canDoFinancial =
    role === "owner" || role === "manager" || role === "advisor" || role === "accountant";
  const isTech = role === "technician";
  const canAssign = role === "owner" || role === "manager" || role === "advisor";
  const isAssignedTech =
    isTech && !!job &&
    (job.assignedTechnicianIds || []).includes(auth.currentUser?.uid ?? "__none__");
  const canEditLines = canEditJob || isAssignedTech;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "jobCards", id), async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const j = snap.data() as JobCard;
      setJob(j);
      setLoading(false);
      if (j.customerId && !customer) {
        const cs = await getDoc(doc(db, "customers", j.customerId));
        if (cs.exists()) setCustomer(cs.data() as Customer);
      }
      if (j.vehicleId && !vehicle) {
        const vs = await getDoc(doc(db, "vehicles", j.vehicleId));
        if (vs.exists()) setVehicle(vs.data() as Vehicle);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + (l.lineTotalMinor || 0), 0);
    const tax = Math.round(subtotal * (BRANCH_TAX_PERCENT / 100));
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  useEffect(() => {
    if (!job || job.invoiceId) return;
    if (!canEditJob) return;
    if (job.subtotalMinor !== totals.subtotal || job.totalMinor !== totals.total) {
      updateDocById("jobCards", id, {
        subtotalMinor: totals.subtotal,
        taxMinor: totals.tax,
        totalMinor: totals.total,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.subtotal, totals.total, canEditJob]);

  async function changeStatus(status: JobStatus) {
    try {
      await updateDocById("jobCards", id, { status });
      notify(`Status → ${JOB_STATUS_META[status].label}`);
    } catch {
      notify("Could not update status.", "error");
    }
  }

  function openLine(kind: "labor" | "part") {
    setLineKind(kind);
    setLineModal(true);
  }

  async function addLine(form: FormData) {
    if (!job) return;
    const kind = lineKind;
    let description = "";
    let unitPriceMinor = 0;
    let partId: string | null = null;
    const quantity = Number(form.get("quantity") || 1);

    if (kind === "part") {
      partId = String(form.get("partId") || "");
      const part = parts.find((p) => p.id === partId);
      if (!part) { notify("Pick a part.", "error"); return; }
      description = part.name;
      unitPriceMinor = part.sellPriceMinor;
    } else {
      description = String(form.get("description") || "").trim();
      unitPriceMinor = toMinor(String(form.get("price") || "0"));
      if (!description) { notify("Describe the labor.", "error"); return; }
    }

    try {
      await createDoc("jobCardLines", job.branchId, {
        jobCardId: id, kind, description, partId, quantity,
        unitPriceMinor, lineTotalMinor: unitPriceMinor * quantity,
      });
      notify("Line added.");
      setLineModal(false);
    } catch {
      notify("Could not add line.", "error");
    }
  }

  async function removeLine(lineId: string) {
    try {
      await deleteDocById("jobCardLines", lineId);
      notify("Line removed.");
    } catch {
      notify("Could not remove line.", "error");
    }
  }

  async function generateInvoice() {
    if (!job) return;
    if (lines.length === 0) { notify("Add at least one line before invoicing.", "error"); return; }
    setInvoicing(true);
    try {
      const invoiceId = await generateInvoiceClient(id);
      notify("Invoice generated.");
      router.push(`/dashboard/billing/${invoiceId}`);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      notify(msg || "Could not generate invoice.", "error");
    } finally {
      setInvoicing(false);
    }
  }

  if (loading) return <CenterSpinner label="Loading job card…" />;
  if (!job)
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Job card not found" />
      </div>
    );

  const techCount = (job.assignedTechnicianIds || []).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <button
        onClick={() => router.push("/dashboard/job-cards")}
        className="flex items-center gap-2 text-sm text-ink-soft transition hover:text-burgundy-600"
      >
        <ArrowLeft size={16} /> All job cards
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone={JOB_STATUS_META[job.status].tone}>
              {JOB_STATUS_META[job.status].label}
            </Badge>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {job.complaint}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              {customer && (
                <Link href={`/dashboard/customers/${job.customerId}`} className="flex items-center gap-1.5 hover:text-burgundy-600">
                  <User size={14} /> {customer.displayName}
                </Link>
              )}
              {vehicle && (
                <Link href={`/dashboard/vehicles/${job.vehicleId}`} className="flex items-center gap-1.5 hover:text-burgundy-600">
                  <Car size={14} /> {vehicle.make} {vehicle.model} · {vehicle.plateNumber}
                </Link>
              )}
            </div>
          </div>
          {canEditJob && (
            <button onClick={() => setDeleteOpen(true)} className="btn-ghost shrink-0 px-3 py-2 text-xs">
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Guided "Next steps" action bar ─────────────────────────────── */}
      {!job.invoiceId && (canEditLines || canAssign || canDoFinancial) && (
        <div className="rounded-2xl border border-burgundy-200 bg-burgundy-50/60 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-burgundy-600 text-xs font-bold text-white">
              →
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">What&apos;s next?</p>
              <p className="text-xs text-ink-soft">Build this job card, then invoice it.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {canEditLines && (
              <button onClick={() => openLine("part")} className="flex flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left transition hover:border-burgundy-300 hover:shadow-soft">
                <Package size={17} className="text-burgundy-600" />
                <span className="text-[13px] font-semibold text-ink">Add Parts</span>
                <span className="text-[11px] text-ink-faint">From inventory</span>
              </button>
            )}
            {canEditLines && (
              <button onClick={() => openLine("labor")} className="flex flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left transition hover:border-burgundy-300 hover:shadow-soft">
                <Wrench size={17} className="text-burgundy-600" />
                <span className="text-[13px] font-semibold text-ink">Add Labor</span>
                <span className="text-[11px] text-ink-faint">Work charges</span>
              </button>
            )}
            {canAssign && (
              <button onClick={() => setAssignOpen(true)} className="flex flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left transition hover:border-burgundy-300 hover:shadow-soft">
                <Users size={17} className="text-burgundy-600" />
                <span className="text-[13px] font-semibold text-ink">
                  {techCount > 0 ? "Technicians" : "Assign Tech"}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {techCount > 0 ? `${techCount} assigned` : "Nobody yet"}
                </span>
              </button>
            )}
            {canDoFinancial && (
              <button onClick={generateInvoice} disabled={invoicing || lines.length === 0}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left transition hover:border-burgundy-300 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-50">
                <Receipt size={17} className="text-burgundy-600" />
                <span className="text-[13px] font-semibold text-ink">
                  {invoicing ? "Generating…" : "Invoice"}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {lines.length === 0 ? "Add a line first" : "Freeze & bill"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status pipeline */}
      <div className="card p-6">
        <p className="mb-3 text-sm font-semibold text-ink">Status</p>
        <div className="flex flex-wrap gap-2">
          {JOB_STATUS_ORDER.map((s) => {
            const active = job.status === s;
            const disabled = !(canEditJob || isTech) || !!job.invoiceId;
            return (
              <button
                key={s}
                disabled={disabled}
                onClick={() => changeStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-burgundy-600 text-white shadow-soft"
                    : "border border-line bg-surface text-ink-soft hover:border-burgundy-300 hover:text-burgundy-600 disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                {JOB_STATUS_META[s].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assigned technicians */}
      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users size={16} className="text-burgundy-500" /> Assigned technicians
          </h2>
          {canAssign && (
            <button onClick={() => setAssignOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
              <Plus size={14} /> Assign
            </button>
          )}
        </div>
        {techCount === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-5 py-5 text-center text-sm text-ink-soft">
            No technician assigned yet. A technician only sees jobs assigned to them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(job.assignedTechnicianIds || []).map((uid) => {
              const t = technicians.find((x) => x.uid === uid);
              return (
                <span key={uid} className="inline-flex items-center gap-2 rounded-full bg-burgundy-50 px-3 py-1.5 text-sm text-burgundy-700">
                  <User size={13} /> {t ? t.name : uid.slice(0, 8)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Labor &amp; Parts</h2>
          {canEditLines && !job.invoiceId && (
            <div className="flex gap-2">
              <button onClick={() => openLine("labor")} className="btn-ghost px-3 py-1.5 text-xs">
                <Wrench size={14} /> Labor
              </button>
              <button onClick={() => openLine("part")} className="btn-ghost px-3 py-1.5 text-xs">
                <Package size={14} /> Part
              </button>
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-5 py-8 text-center text-sm text-ink-soft">
            No lines yet. Use <span className="font-medium text-ink">Add Parts</span> or{" "}
            <span className="font-medium text-ink">Add Labor</span> above to build the estimate.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-center">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id} className="bg-white">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-ink">
                        {l.kind === "part" ? (
                          <Package size={14} className="text-burgundy-400" />
                        ) : (
                          <Wrench size={14} className="text-burgundy-400" />
                        )}
                        {l.description}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-ink-soft">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-ink-soft">{formatMoney(l.unitPriceMinor)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">{formatMoney(l.lineTotalMinor)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canEditLines && !job.invoiceId && (
                        <button onClick={() => setConfirmDelete(l.id)} className="text-ink-faint transition hover:text-burgundy-600" aria-label="Remove">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>VAT ({BRANCH_TAX_PERCENT}%)</span><span>{formatMoney(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold text-ink">
              <span>Total</span><span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice status footer */}
      <div className="card flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {job.invoiceId ? "Invoice generated" : "Ready to invoice?"}
          </h3>
          <p className="text-xs text-ink-soft">
            {job.invoiceId
              ? "This job has been invoiced. View it in Billing."
              : "Freeze these lines into an invoice with tax applied."}
          </p>
        </div>
        {job.invoiceId ? (
          <Link href={`/dashboard/billing/${job.invoiceId}`} className="btn-ghost">
            <Receipt size={16} /> View invoice
          </Link>
        ) : (
          canDoFinancial && (
            <button onClick={generateInvoice} disabled={invoicing || lines.length === 0} className="btn-primary">
              {invoicing ? "Generating…" : "Generate invoice"} <ArrowRight size={16} />
            </button>
          )
        )}
      </div>

      {/* Add line modal */}
      <Modal open={lineModal} onClose={() => setLineModal(false)} title={lineKind === "part" ? "Add Part" : "Add Labor"}>
        <form onSubmit={(e) => { e.preventDefault(); addLine(new FormData(e.currentTarget)); }} className="space-y-4">
          {lineKind === "part" ? (
            <Field label="Part" required hint={parts.length === 0 ? "No parts in inventory yet — add some in Inventory." : "Price pulls from the catalogue sell price."}>
              <select name="partId" className="input-luxe">
                <option value="" disabled selected>Select a part…</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatMoney(p.sellPriceMinor)} ({p.quantityOnHand} in stock)
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Description" required>
                <input name="description" className="input-luxe" placeholder="e.g. Front brake pad replacement" />
              </Field>
              <Field label="Unit price (LKR)" required>
                <input name="price" className="input-luxe" placeholder="0.00" inputMode="decimal" />
              </Field>
            </>
          )}
          <Field label="Quantity" required>
            <input name="quantity" type="number" min={1} defaultValue={1} className="input-luxe" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setLineModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary">Add line</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && removeLine(confirmDelete)}
        title="Remove line?"
        message="This line will be removed from the job card."
        confirmLabel="Remove"
        danger
      />

      {/* Assign technicians modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign technicians">
        {technicians.length === 0 ? (
          <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-ink-soft">
            No technician accounts found. Create a staff member with the Technician role in Users &amp; Roles first.
          </p>
        ) : (
          <div className="space-y-2">
            {technicians.map((t) => {
              const assigned = (job.assignedTechnicianIds || []).includes(t.uid);
              return (
                <button key={t.uid} onClick={() => toggleTechnician(t.uid)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    assigned ? "border-burgundy-300 bg-burgundy-50 text-burgundy-700" : "border-line bg-surface text-ink-soft hover:border-burgundy-300"
                  }`}>
                  <span className="flex items-center gap-2"><User size={15} /> {t.name}</span>
                  {assigned && <Check size={16} className="text-burgundy-600" />}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button onClick={() => setAssignOpen(false)} className="btn-primary">Done</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteJob}
        title="Delete this job card?"
        message="This permanently deletes the job card. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />
    </div>
  );
}
