"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText } from "lucide-react";
import { EmptyState, CenterSpinner, useToast } from "@/components/ui";
import { EmployeeSelector } from "./EmployeeSelector";
import { SummaryCard } from "./SummaryCard";
import { AttendanceRecords } from "./AttendanceRecords";
import { MarkAttendance } from "./MarkAttendance";
import attendanceService from "@/lib/services/attendanceService";
import useEmployees from "@/lib/hooks/useEmployees";
import { useAuth } from "@/lib/auth-context";
import type { Attendance } from "@/lib/types/attendance";

type ViewMode = "mark" | "summary" | "records";

export function AttendanceTab() {
  const { role, roleResolved, branchId } = useAuth();
  const { employees, loading: employeesLoading, error: employeesError, refresh } = useEmployees();
  const { notify } = useToast();

  const [view, setView] = useState<ViewMode>("mark");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("2026-07");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [summary, setSummary] = useState<{ presentDays: number; leaveDays: number; totalDays: number } | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const unauthorized = !(role === "owner" || role === "manager");

  const visibleEmployees = useMemo(() => {
    if (role === "owner") return employees;
    return employees.filter((employee) => employee.branchId === branchId);
  }, [branchId, employees, role]);

  useEffect(() => {
    if (!roleResolved || unauthorized || visibleEmployees.length === 0) {
      setSelectedEmployeeId("");
      return;
    }
    const firstEmployee = visibleEmployees[0];
    if (!selectedEmployeeId && firstEmployee) {
      setSelectedEmployeeId(firstEmployee.id);
    }
  }, [roleResolved, unauthorized, selectedEmployeeId, visibleEmployees]);

  useEffect(() => {
    if (!roleResolved || unauthorized || !selectedEmployeeId) return;
    if (view === "summary") {
      void runSummary(selectedEmployeeId, selectedMonth);
    }
    if (view === "records") {
      void runRecords(selectedEmployeeId, selectedMonth, selectedStatus);
    }
  }, [roleResolved, unauthorized, selectedEmployeeId, selectedMonth, selectedStatus, view]);

  async function runSummary(employeeId: string, month: string) {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await attendanceService.getAttendanceSummary(employeeId, month);
      setSummary({
        presentDays: res.presentDays ?? 0,
        leaveDays: res.leaveDays ?? 0,
        totalDays: res.totalDays ?? 0,
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Unable to load summary.";
      setSummaryError(msg);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function runRecords(employeeId: string, month: string, status: string) {
    setLoadingRecords(true);
    setRecordsError(null);
    try {
      const res = await attendanceService.getAttendanceList({ employeeId, month });
      const filtered = status
        ? res.attendance.filter((record) => record.status === status)
        : res.attendance;
      setRecords(filtered);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Unable to load attendance records.";
      setRecordsError(msg);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }

  async function handleAttendanceSaved() {
    notify("Attendance saved", "success");
    if (view === "records") {
      await runRecords(selectedEmployeeId, selectedMonth, selectedStatus);
    }
    if (view === "summary") {
      await runSummary(selectedEmployeeId, selectedMonth);
    }
    await refresh();
  }

  if (!roleResolved) {
    return <CenterSpinner label="Checking access" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setView("mark")}
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${view === "mark" ? "border-burgundy-500 bg-burgundy-50 text-burgundy-700" : "border-line bg-white text-ink-soft"}`}
        >
          Mark Attendance
        </button>
        <button
          type="button"
          onClick={() => setView("summary")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${view === "summary" ? "border-burgundy-500 bg-burgundy-50 text-burgundy-700" : "border-line bg-white text-ink-soft"}`}
        >
          <FileText size={16} />
          Attendance Summary Report
        </button>
        <button
          type="button"
          onClick={() => setView("records")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${view === "records" ? "border-burgundy-500 bg-burgundy-50 text-burgundy-700" : "border-line bg-white text-ink-soft"}`}
        >
          <ClipboardList size={16} />
          View Attendance Records
        </button>
      </div>

      {unauthorized ? (
        <EmptyState title="Not authorized" hint="Only owners and managers can access attendance reporting." />
      ) : employeesLoading ? (
        <CenterSpinner label="Loading employees" />
      ) : employeesError ? (
        <EmptyState title="Could not load employees" hint={employeesError} />
      ) : visibleEmployees.length === 0 ? (
        <EmptyState title="No employees available" hint="No employees were found for your branch." />
      ) : (
        <div className="space-y-4">
          {view === "mark" ? (
            <MarkAttendance employees={visibleEmployees} onSaved={handleAttendanceSaved} />
          ) : (
            <>
              <div className="card p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <EmployeeSelector
                    label="Employee"
                    value={selectedEmployeeId}
                    options={visibleEmployees.map((employee) => ({ id: employee.id, label: employee.fullName ?? employee.displayName ?? employee.email }))}
                    onChange={setSelectedEmployeeId}
                  />
                  <label className="flex flex-col gap-1 text-sm text-ink-soft">
                    <span className="font-medium text-ink">Month</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400"
                    />
                  </label>
                  {view === "records" && (
                    <label className="flex flex-col gap-1 text-sm text-ink-soft">
                      <span className="font-medium text-ink">Status</span>
                      <select
                        value={selectedStatus}
                        onChange={(event) => setSelectedStatus(event.target.value)}
                        className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400"
                      >
                        <option value="">All statuses</option>
                        <option value="present">Present</option>
                        <option value="on_leave">On Leave</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>

              {view === "summary" ? (
                <div className="space-y-4">
                  {loadingSummary ? (
                    <CenterSpinner label="Loading summary" />
                  ) : summaryError ? (
                    <EmptyState title="Could not load summary" hint={summaryError} />
                  ) : !summary ? (
                    <EmptyState title="No summary available" hint="Select an employee and month to view their attendance summary." />
                  ) : (
                    <div className="card p-5">
                      <div className="mb-4 flex items-center gap-2 text-burgundy-600">
                        <FileText size={18} />
                        <h3 className="text-lg font-semibold text-ink">Attendance Summary</h3>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard label="Employee Name" value={visibleEmployees.find((employee) => employee.id === selectedEmployeeId)?.fullName ?? visibleEmployees.find((employee) => employee.id === selectedEmployeeId)?.displayName ?? "—"} />
                        <SummaryCard label="Employee ID" value={selectedEmployeeId || "—"} />
                        <SummaryCard label="Month" value={selectedMonth} />
                        <SummaryCard label="Present Days" value={summary.presentDays} tone="green" />
                        <SummaryCard label="Leave Days" value={summary.leaveDays} tone="amber" />
                        <SummaryCard label="Total Attendance Days" value={summary.totalDays} tone="blue" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <AttendanceRecords
                  records={records}
                  employees={visibleEmployees}
                  loading={loadingRecords}
                  error={recordsError}
                  employeeId={selectedEmployeeId}
                  month={selectedMonth}
                  status={selectedStatus}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
