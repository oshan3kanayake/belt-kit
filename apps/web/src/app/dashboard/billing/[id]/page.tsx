"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, onSnapshot, collection, getDocs, query, where as fsWhere } from "firebase/firestore";
import { ArrowLeft, User, Plus, Wallet, ClipboardList, Banknote, CreditCard, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCollection, where } from "@/lib/useCollection";
import { createDoc, updateDocById, deleteDocById } from "@/lib/db-write";
import { Invoice, Customer, Payment } from "@/lib/models";
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
import { CardTerminal } from "@/components/CardTerminal";

// Only two live methods now: cash and (mock) card.
type PayMethod = "cash" | "card";

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

  // Records a payment (used by both Cash and the mock Card terminal).
  async function recordPayment(method: PayMethod, amountMinor: number) {
    if (!invoice) return;
    if (amountMinor <= 0) {
      notify("Enter a valid amount.", "error");
      return;
    }
    setSaving(true);
    try {
      await createDoc("payments", invoice.branchId, {
        invoiceId: id,
        customerId: invoice.customerId,
        amountMinor,
        method,
        reference: method === "card" ? "Card · demo terminal" : undefined,
      });
      const newPaid = invoice.amountPaidMinor + amountMinor;
      const status =
        newPaid >= invoice.totalMinor
          ? "paid"
          : newPaid > 0
          ? "part_paid"
          : invoice.status;
      await updateDocById("invoices", id, {
        amountPaidMinor: newPaid,
        status,
      });
      notify(
        method === "card" ? "Card payment approved." : "Payment recorded."
      );
      setPayModal(false);
      setShowTerminal(false);
    } catch {
      notify("Could not record payment.", "error");
    } finally {
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
    if (payMethod === "card") {
      setShowTerminal(true); // launches the virtual terminal
    } else {
      recordPayment("cash", amountMinor);
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

  const due = invoice.totalMinor - invoice.amountPaidMinor;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/billing")}
          className="flex items-center gap-2 font-sans text-sm text-ink-soft transition hover:text-burgundy-600"
        >
          <ArrowLeft size={16} /> All invoices
        </button>
        {canPay && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="btn-ghost px-3 py-2 text-xs"
            title="Delete invoice"
          >
            <Trash2 size={15} /> Delete invoice
          </button>
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
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 font-sans text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatMoney(invoice.subtotalMinor, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
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
          {canPay && due > 0 && (
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
        title={showTerminal ? "Card payment" : "Record Payment"}
      >
        {showTerminal ? (
          <CardTerminal
            amountMinor={toMinor(payAmountStr)}
            currency={invoice.currency}
            onApproved={() => recordPayment("card", toMinor(payAmountStr))}
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
                <button
                  type="button"
                  onClick={() => setPayMethod("cash")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    payMethod === "cash"
                      ? "border-burgundy-400 bg-burgundy-50"
                      : "border-line bg-surface hover:border-rosegold-300"
                  }`}
                >
                  <Banknote
                    size={22}
                    className={
                      payMethod === "cash" ? "text-burgundy-600" : "text-ink-faint"
                    }
                  />
                  <div>
                    <p className="font-sans text-sm font-medium text-ink">Cash</p>
                    <p className="font-sans text-xs text-ink-faint">
                      Record a cash payment
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("card")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    payMethod === "card"
                      ? "border-burgundy-400 bg-burgundy-50"
                      : "border-line bg-surface hover:border-rosegold-300"
                  }`}
                >
                  <CreditCard
                    size={22}
                    className={
                      payMethod === "card" ? "text-burgundy-600" : "text-ink-faint"
                    }
                  />
                  <div>
                    <p className="font-sans text-sm font-medium text-ink">Card</p>
                    <p className="font-sans text-xs text-ink-faint">
                      Tap on the terminal
                    </p>
                  </div>
                </button>
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
                {payMethod === "card" ? (
                  <>
                    <CreditCard size={17} /> Continue to terminal
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
