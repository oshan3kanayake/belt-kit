"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal, Field, useToast } from "@/components/ui";
import { Employee } from "@/lib/models";
import employeeService from "@/lib/services/employeeService";
import { toMinor } from "@/lib/format";

type Props = {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EmployeePaymentModal({ open, employee, onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setMonth("");
    setAmount("");
    setPaidDate("");
    setErrors({});
  }

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!employee?.id) nextErrors.employeeId = "No employee selected.";
    if (!month.trim()) nextErrors.month = "Month is required.";
    else if (!/^\d{4}-\d{2}$/.test(month.trim())) nextErrors.month = "Use the format YYYY-MM.";
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      nextErrors.amount = "Amount must be greater than zero.";
    }
    if (!paidDate) nextErrors.paidDate = "Paid date is required.";
    else {
      const parsed = new Date(paidDate);
      if (Number.isNaN(parsed.getTime())) nextErrors.paidDate = "Please enter a valid date.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    if (!employee?.id) return;

    setBusy(true);
    try {
      await employeeService.createEmployeePayment({
        employeeId: employee.id,
        month: month.trim(),
        amountPaidMinor: toMinor(amount),
        paidDate: paidDate || null,
      });
      notify("Payment recorded", "success");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Could not record payment.";
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Employee" required>
          <input value={employee?.fullName ?? employee?.displayName ?? employee?.email ?? ""} readOnly className="input-luxe" />
          {errors.employeeId && <p className="mt-1 text-sm text-rose-600">{errors.employeeId}</p>}
        </Field>

        <Field label="Month" required hint="Use YYYY-MM format">
          <input value={month} onChange={(ev) => setMonth(ev.target.value)} className="input-luxe" placeholder="2026-07" />
          {errors.month && <p className="mt-1 text-sm text-rose-600">{errors.month}</p>}
        </Field>

        <Field label="Amount paid" required>
          <input value={amount} onChange={(ev) => setAmount(ev.target.value)} className="input-luxe" placeholder="500.00" />
          {errors.amount && <p className="mt-1 text-sm text-rose-600">{errors.amount}</p>}
        </Field>

        <Field label="Paid date" required>
          <input value={paidDate} onChange={(ev) => setPaidDate(ev.target.value)} type="date" className="input-luxe" />
          {errors.paidDate && <p className="mt-1 text-sm text-rose-600">{errors.paidDate}</p>}
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
