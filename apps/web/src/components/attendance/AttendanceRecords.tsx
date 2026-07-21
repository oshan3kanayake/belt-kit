"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui";
import type { Attendance } from "@/lib/types/attendance";
import type { Employee } from "@/lib/models";

type AttendanceRecordsProps = {
  records: Attendance[];
  employees: Employee[];
  loading?: boolean;
  error?: string | null;
  employeeId: string;
  month: string;
  status: string;
};

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function formatTimestamp(value?: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return "—";
}

export function AttendanceRecords({ records, employees, loading, error, employeeId, month, status }: AttendanceRecordsProps) {
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const matchesEmployee = !employeeId || record.employeeId === employeeId;
      const matchesMonth = !month || record.date.startsWith(month);
      const matchesStatus = !status || record.status === status;
      return matchesEmployee && matchesMonth && matchesStatus;
    });
  }, [records, employeeId, month, status]);

  if (loading) {
    return <div className="rounded-xl border border-line bg-white p-6 text-sm text-ink-soft">Loading records…</div>;
  }

  if (error) {
    return <EmptyState title="Could not load records" hint={error} />;
  }

  if (filtered.length === 0) {
    return <EmptyState title="No attendance records" hint="Try a different employee, month, or status filter." />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Employee ID</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Note</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map((record) => {
              const employee = employeeMap.get(record.employeeId);
              return (
                <tr key={record.id} className="align-top">
                  <td className="px-5 py-4 text-ink-soft">{formatDate(record.date)}</td>
                  <td className="px-5 py-4 font-medium text-ink">{employee?.fullName ?? employee?.displayName ?? record.employeeId}</td>
                  <td className="px-5 py-4 text-ink-soft">{record.employeeId}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${record.status === "present" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {record.status === "present" ? "Present" : "On Leave"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{record.note || "—"}</td>
                  <td className="px-5 py-4 text-ink-soft">{formatTimestamp(record.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
