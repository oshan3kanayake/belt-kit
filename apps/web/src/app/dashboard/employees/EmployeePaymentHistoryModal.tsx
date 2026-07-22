"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Field, GearLoader, Modal, useToast } from "@/components/ui";
import { Employee } from "@/lib/models";
import employeeService from "@/lib/services/employeeService";
import { formatMoney } from "@/lib/format";

type Props = {
  open: boolean;
  employees: Employee[];
  onClose: () => void;
};

type PaymentRecord = {
  id?: string;
  employeeId: string;
  employeeName?: string;
  month?: string;
  amountPaidMinor?: number;
  amountMinor?: number;
  paidDate?: string | { toDate: () => Date } | null;
};

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function getMonthKey(month?: string, paidDate?: unknown): string | null {
  if (typeof month === "string") {
    if (/^\d{4}-\d{2}$/.test(month)) return month;
    if (/^\d{4}-\d{2}-\d{2}$/.test(month)) return month.slice(0, 7);
  }

  const date = normalizeDate(paidDate);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey?: string | null): string {
  if (!monthKey) return "—";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function formatPaymentDate(value: unknown): string {
  const date = normalizeDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function EmployeePaymentHistoryModal({ open, employees, onClose }: Props) {
  const { notify } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("all");

  useEffect(() => {
    if (!open) {
      setSelectedMonth("all");
      return;
    }

    if (employees.length === 0) {
      setPayments([]);
      setError(null);
      setLoading(false);
      return;
    }

    async function loadPayments() {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          employees.map(async (employee) => {
            const res = await employeeService.getEmployeePayments(employee.id);
            return (res?.payments ?? []).map((payment) => ({
              ...payment,
              employeeId: employee.id,
              employeeName: employee.fullName ?? employee.displayName ?? employee.email,
            }));
          })
        );
        setPayments(results.flat());
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? "Could not load payment history.";
        setError(msg);
        notify(msg, "error");
      } finally {
        setLoading(false);
      }
    }

    void loadPayments();
  }, [employees, notify, open]);

  const monthOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Months" }];
    const seen = new Set<string>();
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (!seen.has(currentMonth)) {
      options.push({ value: currentMonth, label: "Current Month" });
      seen.add(currentMonth);
    }

    payments.forEach((payment) => {
      const monthKey = getMonthKey(payment.month, payment.paidDate);
      if (!monthKey || seen.has(monthKey)) return;
      seen.add(monthKey);
      options.push({ value: monthKey, label: formatMonthLabel(monthKey) });
    });

    return options;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (selectedMonth === "all") return payments;
    return payments.filter((payment) => {
      const paymentMonth = getMonthKey(payment.month, payment.paidDate);
      return paymentMonth === selectedMonth;
    });
  }, [payments, selectedMonth]);

  const totalPaid = filteredPayments.reduce((sum, payment) => sum + (payment.amountPaidMinor ?? payment.amountMinor ?? 0), 0);

  return (
    <Modal open={open} onClose={onClose} title="Employee Payment History" size="xl">
      <div className="space-y-4">
        <Field label="Filter by month">
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="input-luxe">
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {loading ? (
          <div className="flex justify-center py-8">
            <GearLoader size={40} />
          </div>
        ) : error ? (
          <EmptyState title="Could not load payments" hint={error} />
        ) : filteredPayments.length === 0 ? (
          <EmptyState title="No payments found" hint="No payment records match the selected month." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">Total paid</span>
                <span className="font-semibold text-ink">{formatMoney(totalPaid)}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Payment Month</th>
                    <th className="px-4 py-3">Amount Paid</th>
                    <th className="px-4 py-3">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id ?? `${payment.employeeId}-${payment.month}-${payment.paidDate}`} className="bg-white">
                      <td className="px-4 py-3 text-ink">{payment.employeeName ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{formatMonthLabel(getMonthKey(payment.month, payment.paidDate))}</td>
                      <td className="px-4 py-3 text-ink">{formatMoney(payment.amountPaidMinor ?? payment.amountMinor ?? 0)}</td>
                      <td className="px-4 py-3 text-ink-soft">{formatPaymentDate(payment.paidDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
