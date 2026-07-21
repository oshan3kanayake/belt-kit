"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Save } from "lucide-react";
import { useToast } from "@/components/ui";
import { EmployeeSelector } from "./EmployeeSelector";
import attendanceService from "@/lib/services/attendanceService";
import type { AttendanceStatus } from "@/lib/types/attendance";
import type { Employee } from "@/lib/models";

type MarkAttendanceProps = {
  employees: Employee[];
  onSaved?: () => void;
};

const today = new Date();
const defaultDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;

export function MarkAttendance({ employees, onSaved }: MarkAttendanceProps) {
  const { notify } = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const employeeOptions = useMemo(() => employees.map((employee) => ({
    id: employee.id,
    label: employee.fullName ?? employee.displayName ?? employee.email,
  })), [employees]);

  useEffect(() => {
    if (!employeeId && employeeOptions.length > 0) {
      setEmployeeId(employeeOptions[0].id);
    }
  }, [employeeId, employeeOptions]);

  async function handleSave() {
    if (!employeeId || !status || !date) {
      notify("Select an employee, date, and status before saving.", "error");
      return;
    }

    setSaving(true);
    try {
      await attendanceService.createAttendance({
        employeeId,
        date,
        status,
        note,
      });
      notify("Attendance saved", "success");
      setNote("");
      setDate(defaultDate);
      setStatus("");
      onSaved?.();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Could not save attendance.";
      notify(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
        <CalendarCheck2 size={18} />
        <h3 className="text-lg font-semibold text-ink">Mark Today&apos;s Attendance</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EmployeeSelector
          label="Employee"
          value={employeeId}
          options={employeeOptions}
          onChange={setEmployeeId}
        />

        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400"
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="font-medium text-ink">Status</span>
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStatus("present")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${status === "present" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink-soft"}`}
          >
            Present
          </button>
          <button
            type="button"
            onClick={() => setStatus("on_leave")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${status === "on_leave" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-line bg-white text-ink-soft"}`}
          >
            On Leave
          </button>
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1 text-sm text-ink-soft">
        <span className="font-medium text-ink">Note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Add an optional note"
          className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400"
        />
      </label>

      <button type="button" onClick={handleSave} className="btn-primary mt-5 inline-flex items-center gap-2" disabled={saving}>
        <Save size={16} />
        {saving ? "Saving…" : "Save Attendance"}
      </button>
    </div>
  );
}
