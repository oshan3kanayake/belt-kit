"use client";

import { useEffect, useState } from "react";
import { Modal, EmptyState, GearLoader, useToast } from "@/components/ui";
import { Employee } from "@/lib/models";
import employeeService from "@/lib/services/employeeService";
import { formatMoney } from "@/lib/format";

type Props = {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
};

interface PaymentRecord {
  id?: string;
  month?: string;
  amountPaidMinor?: number;
  paidDate?: string | null;
  createdAt?: unknown;
}

export default function PaymentHistory({ open, employee, onClose }: Props) {
  const { notify } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !employee?.id) return;

    const employeeId = employee.id;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await employeeService.getEmployeePaymentHistory(employeeId);
        const history = (res?.payments ?? []) as PaymentRecord[];
        setPayments(history);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? "Could not load payment history.";
        setError(msg);
        notify(msg, "error");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [employee?.id, notify, open]);

  const total = payments.reduce((sum, item) => sum + (item.amountPaidMinor ?? 0), 0);

  return (
    <Modal open={open} onClose={onClose} title="Payment history" size="lg">
      {loading ? (
        <div className="flex justify-center py-12">
          <GearLoader size={40} />
        </div>
      ) : error ? (
        <EmptyState title="Could not load payments" hint={error} />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments yet" hint="No payment records have been added for this employee." />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface-muted/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Total paid</span>
              <span className="font-semibold text-ink">{formatMoney(total)}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Amount Paid</th>
                  <th className="px-4 py-3">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => (
                  <tr key={payment.id ?? `${payment.month}-${payment.paidDate}`} className="bg-white">
                    <td className="px-4 py-3 text-ink">{payment.month ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{formatMoney(payment.amountPaidMinor ?? 0)}</td>
                    <td className="px-4 py-3 text-ink-soft">{payment.paidDate ? String(payment.paidDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
