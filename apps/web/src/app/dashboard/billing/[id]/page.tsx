"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where as fsWhere,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  User,
  Plus,
  Wallet,
  ClipboardList,
  Banknote,
  CreditCard,
  Trash2,
  Landmark,
  Smartphone,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCollection, where } from "@/lib/useCollection";
import { updateDocById, deleteDocById } from "@/lib/db-write";
import {
  Invoice,
  Customer,
  Payment,
} from "@/lib/models";
import { formatMoney, formatDateTime, toMinor } from "@/lib/format";
import {
  CenterSpinner,
  EmptyState,
  Badge,
  Modal,
  Field,
  ConfirmDialog,
  useToast,
} from "@/components/ui";
import {
  PaymentTerminal,
  SimulatedPaymentResult,
} from "@/components/PaymentTerminal";

type PayMethod = Payment["method"];

const PAYMENT_METHODS = [
  {
    method: "cash" as const,
    label: "Cash",
    hint: "Confirm at the counter",
    icon: Banknote,
  },
  {
    method: "card" as const,
    label: "Card",
    hint: "Demo card checkout",
    icon: CreditCard,
  },
  {
    method: "bank_transfer" as const,
    label: "Bank transfer",
    hint: "Simulated verification",
    icon: Landmark,
  },
  {
    method: "wallet" as const,
    label: "Mobile wallet",
    hint: "Demo QR payment",
    icon: Smartphone,
  },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const { notify } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [payAmountStr, setPayAmountStr] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const paymentInFlight = useRef(false);

  const { data: payments } = useCollection<Payment>("payments", [
    where("invoiceId", "==", id),
  ]);

  const canPay =
    role === "owner" || role === "manager" || role === "advisor" || role === "accountant";


  useEffect(() => {
    const unsub = onSnapshot(doc(db, "invoices", id), async (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const inv = snap.data() as Invoice;
      setInvoice(inv);
      setLoading(false);
      if (inv.customerId && !customer) {
        const cs = await getDoc(doc(db, "customers", inv.customerId));
        if (cs.exists()) setCustomer(cs.data() as Customer);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Atomically records a payment and updates the invoice balance. This avoids
  // duplicate or partially-saved payments during the simulated online flow.
  async function recordPayment(
    method: PayMethod,
    amountMinor: number,
    result?: SimulatedPaymentResult
  ) {
    if (!invoice || paymentInFlight.current) return;
    if (amountMinor <= 0) {
      notify("Enter a valid amount.", "error");
      return;
    }
    paymentInFlight.current = true;
    setSaving(true);
    try {
      const invoiceRef = doc(db, "invoices", id);
      const paymentRef = doc(collection(db, "payments"));
      const auditRef = doc(collection(db, "auditLog"));
      const uid = auth.currentUser?.uid ?? "unknown";

      await runTransaction(db, async (tx) => {
        const freshSnap = await tx.get(invoiceRef);
        if (!freshSnap.exists()) throw new Error("Invoice no longer exists.");
        const fresh = freshSnap.data() as Invoice;
        if (fresh.status === "void") throw new Error("A void invoice cannot be paid.");

        const currentPaid = fresh.amountPaidMinor ?? 0;
        const currentDue = Math.max(0, fresh.totalMinor - currentPaid);
        if (amountMinor > currentDue) {
          throw new Error(`Payment cannot exceed ${formatMoney(currentDue, fresh.currency)}.`);
        }

        const newPaid = currentPaid + amountMinor;
        const status = newPaid >= fresh.totalMinor ? "paid" : "part_paid";
        const paymentData = {
          branchId: fresh.branchId,
          invoiceId: id,
          customerId: fresh.customerId,
          amountMinor,
          method,
          ...(result?.reference ? { reference: result.reference } : {}),
          ...(result?.cardLast4 ? { cardLast4: result.cardLast4 } : {}),
          ...(result?.provider ? { provider: result.provider } : {}),
          archived: false,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        tx.set(paymentRef, paymentData);
        tx.update(invoiceRef, {
          amountPaidMinor: newPaid,
          status,
          updatedByUid: uid,
          updatedAt: serverTimestamp(),
        });
        tx.set(auditRef, {
          branchId: fresh.branchId,
          actorUid: uid,
          action: "payment.created",
          entityType: "payment",
          entityId: paymentRef.id,
          after: { invoiceId: id, amountMinor, method },
          at: serverTimestamp(),
        });
      });

      const label = method.replace("_", " ");
      notify(`${label[0].toUpperCase()}${label.slice(1)} payment recorded.`);
      setPayModal(false);
      setShowTerminal(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not record payment.",
        "error"
      );
      throw error;
    } finally {
      paymentInFlight.current = false;
      setSaving(false);
    }
  }

  function openPayModal() {
    setPayMethod("cash");
    setPayAmountStr((due / 100).toString());
    setShowTerminal(false);
    setPayModal(true);
  }

  function submitPayment() {
    const amountMinor = toMinor(payAmountStr);
    if (amountMinor <= 0) {
      notify("Enter a valid amount.", "error");
      return;
    }
    if (amountMinor > due) {
      notify(`Payment cannot exceed ${formatMoney(due, invoice?.currency)}.`, "error");
      return;
    }
    if (payMethod !== "cash") {
      setShowTerminal(true);
    } else {
      void recordPayment("cash", amountMinor, {
        reference: `CASH-${Date.now().toString().slice(-8)}`,
        provider: "Cash counter",
      }).catch(() => {});
    }
  }

  async function deleteInvoice() {
    if (!invoice) return;
    try {
      // Delete the invoice's payments, unlink the job card (so it can be
      // re-invoiced), then delete the invoice itself.
      const paySnap = await getDocs(
        query(collection(db, "payments"), fsWhere("invoiceId", "==", id))
      );
      await Promise.all(paySnap.docs.map((d) => deleteDocById("payments", d.id)));
      if (invoice.jobCardId) {
        await updateDocById("jobCards", invoice.jobCardId, {
          invoiceId: null,
        }).catch(() => {});
      }
      await deleteDocById("invoices", id);
      notify("Invoice deleted.");
      router.push("/dashboard/billing");
    } catch {
      notify("Could not delete invoice.", "error");
    }
  }

  if (loading) return <CenterSpinner label="Loading invoice…" />;
  if (!invoice)
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Invoice not found" />
      </div>
    );

  const due = Math.max(0, invoice.totalMinor - invoice.amountPaidMinor);
  const extraChargesTotal = (invoice.extraCharges ?? []).reduce(
    (total, charge) => total + (charge.amountMinor ?? 0),
    0
  );
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => router.push("/dashboard/billing")}
          className="flex items-center gap-2 font-sans text-sm text-ink-soft transition hover:text-burgundy-600"
        >
          <ArrowLeft size={16} /> All invoices
        </button>
        {canPay && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              onClick={() => setDeleteOpen(true)}
              className="btn-ghost px-3 py-2 text-xs"
              title="Delete invoice"
            >
              <Trash2 size={15} /> Delete invoice
            </button>
          </div>
        )}
      </div>

      {/* Invoice document */}
      <div className="card overflow-hidden">
        <div className="bg-burgundy-deep px-8 py-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-sans text-xs uppercase tracking-[0.2em] text-rosegold-200">
                Invoice
              </p>
              <h1 className="mt-1 font-serif text-2xl font-semibold">
                {formatMoney(invoice.totalMinor, invoice.currency)}
              </h1>
            </div>
            <Badge
              tone={
                invoice.status === "paid"
                  ? "green"
                  : invoice.status === "part_paid"
                  ? "amber"
                  : "gold"
              }
            >
              {invoice.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm text-white/80">
            {customer && (
              <span className="flex items-center gap-1.5">
                <User size={14} /> {customer.displayName}
              </span>
            )}
            <span>{formatDateTime(invoice.createdAt)}</span>
            <Link
              href={`/dashboard/job-cards/${invoice.jobCardId}`}
              className="flex items-center gap-1.5 text-rosegold-200 hover:text-white"
            >
              <ClipboardList size={14} /> View job card
            </Link>
          </div>
        </div>

        {/* Lines */}
        <div className="px-8 py-6">
          <table className="w-full text-left font-sans text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="pb-2">Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoice.lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 text-ink">{l.description}</td>
                  <td className="py-2.5 text-center text-ink-soft">
                    {l.quantity}
                  </td>
                  <td className="py-2.5 text-right text-ink-soft">
                    {formatMoney(l.unitPriceMinor, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right font-medium text-ink">
                    {formatMoney(l.lineTotalMinor, invoice.currency)}
                  </td>
                </tr>
              ))}
              {(invoice.extraCharges ?? []).map((charge, idx) => (
                <tr key={`extra-${idx}`} className="bg-amber-50/40">
                  <td className="py-2.5 text-ink">
                    {charge.description}
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Extra charge
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-ink-soft">1</td>
                  <td className="py-2.5 text-right text-ink-soft">
                    {formatMoney(charge.amountMinor, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right font-medium text-ink">
                    {formatMoney(charge.amountMinor, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 font-sans text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatMoney(invoice.subtotalMinor, invoice.currency)}</span>
              </div>
              {extraChargesTotal > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Extra charges</span>
                  <span>+ {formatMoney(extraChargesTotal, invoice.currency)}</span>
                </div>
              )}
              {(invoice.discountMinor ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>
                    Discount
                    {invoice.discountType === "percent"
                      ? ` (${invoice.discountValue ?? 0}%)`
                      : ""}
                  </span>
                  <span>− {formatMoney(invoice.discountMinor ?? 0, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-soft">
                <span>
                  Tax
                  {typeof invoice.taxRatePercent === "number"
                    ? ` (${invoice.taxRatePercent}%)`
                    : ""}
                </span>
                <span>{formatMoney(invoice.taxMinor, invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-serif text-lg font-semibold text-burgundy-700">
                <span>Total</span>
                <span>{formatMoney(invoice.totalMinor, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Paid</span>
                <span>{formatMoney(invoice.amountPaidMinor, invoice.currency)}</span>
              </div>
              {due > 0 && (
                <div className="flex justify-between font-medium text-burgundy-600">
                  <span>Due</span>
                  <span>{formatMoney(due, invoice.currency)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="card mt-6 p-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-ink">Payments</h2>
          {canPay && due > 0 && invoice.status !== "void" && (
            <button onClick={openPayModal} className="btn-primary">
              <Plus size={18} /> Record payment
            </button>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-muted/40 px-5 py-8 text-center font-sans text-sm text-ink-soft">
            No payments recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Wallet size={16} className="text-rosegold-500" />
                  <div>
                    <p className="font-sans text-sm font-medium capitalize text-ink">
                      {p.method.replace("_", " ")}
                    </p>
                    <p className="font-sans text-xs text-ink-faint">
                      {formatDateTime(p.createdAt)}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.cardLast4 ? ` · •••• ${p.cardLast4}` : ""}
                      {p.provider ? ` · ${p.provider}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-sans font-semibold text-emerald-600">
                  {formatMoney(p.amountMinor, invoice.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record payment modal */}
      <Modal
        open={payModal}
        onClose={() => {
          setPayModal(false);
          setShowTerminal(false);
        }}
        title={showTerminal ? "Demo online payment" : "Record Payment"}
      >
        {showTerminal ? (
          <PaymentTerminal
            method={payMethod === "cash" ? "card" : payMethod}
            amountMinor={toMinor(payAmountStr)}
            currency={invoice.currency}
            onApproved={(result) =>
              recordPayment(payMethod, toMinor(payAmountStr), result)
            }
            onCancel={() => setShowTerminal(false)}
          />
        ) : (
          <div className="space-y-5">
            <Field label="Amount (LKR)" required hint={`Due: ${formatMoney(due)}`}>
              <input
                className="input-luxe"
                placeholder="0.00"
                inputMode="decimal"
                value={payAmountStr}
                onChange={(e) => setPayAmountStr(e.target.value)}
              />
            </Field>

            <div>
              <span className="label-luxe">Payment method</span>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((option) => {
                  const Icon = option.icon;
                  const selected = payMethod === option.method;
                  return (
                    <button
                      key={option.method}
                      type="button"
                      onClick={() => setPayMethod(option.method)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-burgundy-400 bg-burgundy-50"
                          : "border-line bg-surface hover:border-rosegold-300"
                      }`}
                    >
                      <Icon
                        size={22}
                        className={selected ? "text-burgundy-600" : "text-ink-faint"}
                      />
                      <div>
                        <p className="font-sans text-sm font-medium text-ink">
                          {option.label}
                        </p>
                        <p className="font-sans text-xs text-ink-faint">
                          {option.hint}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPayment}
                disabled={saving}
                className="btn-primary"
              >
                {payMethod !== "cash" ? (
                  <>
                    <CreditCard size={17} /> Continue to demo
                  </>
                ) : saving ? (
                  "Saving…"
                ) : (
                  "Record cash payment"
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteInvoice}
        title="Delete this invoice?"
        message="This permanently deletes the invoice and its recorded payments, and unlinks the job card so it can be invoiced again. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
      />
    </div>
  );
}
