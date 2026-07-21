"use client";

import { CalendarClock, Save } from "lucide-react";
import type { Attendance, AttendanceStatus } from "@/lib/types/attendance";
import type { Employee } from "@/lib/models";

type AttendanceDraft = {
  status?: AttendanceStatus;
  note: string;
};

type AttendanceTableProps = {
  employees: Employee[];
  attendance: Attendance[];
  selectedDate: string;
  loading?: boolean;
  saving?: boolean;
  savingEmployeeId?: string | null;
  drafts: Record<string, AttendanceDraft>;
  onDraftChange: (employeeId: string, field: "status" | "note", value: AttendanceStatus | string | undefined) => void;
  onSave: (employeeId?: string) => void;
};

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function AttendanceTable({
  employees,
  attendance,
  selectedDate,
  loading,
  saving,
  savingEmployeeId,
  drafts,
  onDraftChange,
  onSave,
}: AttendanceTableProps) {
  const attendanceByEmployee = new Map(attendance.map((record) => [record.employeeId, record]));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line bg-surface-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-faint">Attendance roster</p>
          <p className="text-sm text-ink-soft">{formatDate(selectedDate)}</p>
        </div>
        <button type="button" onClick={() => onSave()} className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Present</th>
              <th className="px-5 py-3">Leave</th>
              <th className="px-5 py-3">Note</th>
              <th className="px-5 py-3">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {employees.map((employee) => {
              const record = attendanceByEmployee.get(employee.id);
              const draft = drafts[employee.id] ?? { status: record?.status, note: record?.note ?? "" };
              const isPresent = draft.status === "present";
              const isLeave = draft.status === "on_leave";

              return (
                <tr key={employee.id} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-medium text-ink">{employee.fullName ?? employee.displayName ?? employee.email}</div>
                    <div className="mt-1 text-xs text-ink-faint">{employee.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onDraftChange(employee.id, "status", isPresent ? undefined : "present")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${isPresent ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink-soft"}`}
                    >
                      Present
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onDraftChange(employee.id, "status", isLeave ? undefined : "on_leave")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${isLeave ? "border-amber-500 bg-amber-50 text-amber-700" : "border-line bg-white text-ink-soft"}`}
                    >
                      Leave
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <textarea
                      value={draft.note}
                      onChange={(event) => onDraftChange(employee.id, "note", event.target.value)}
                      placeholder="Add a note"
                      rows={3}
                      className="w-full min-w-[220px] rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-burgundy-400"
                      disabled={loading}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onSave(employee.id)}
                      className="btn-ghost inline-flex items-center gap-2"
                      disabled={saving || !draft.status}
                    >
                      <Save size={15} />
                      {savingEmployeeId === employee.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
