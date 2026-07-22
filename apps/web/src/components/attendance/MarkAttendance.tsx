"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck2, CheckCircle2, Pencil, RefreshCw, Save, Search } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { CenterSpinner, EmptyState, useToast } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import attendanceService from "@/lib/services/attendanceService";
import type { Attendance, AttendanceStatus, SerializedTimestamp } from "@/lib/types/attendance";
import type { Employee } from "@/lib/models";
import { EmployeeSelector } from "./EmployeeSelector";
import { SummaryCard } from "./SummaryCard";

type Filter = "all" | "not_marked" | AttendanceStatus;

type Props = {
  employees: Employee[];
  initialDate?: string;
  initialEmployeeId?: string;
  editRequest?: { employeeId: string; date: string; nonce: number } | null;
};

function dateInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function employeeName(employee: Employee) {
  return employee.fullName ?? employee.displayName ?? employee.email;
}

function formatSelectedDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTimestamp(value?: SerializedTimestamp | string | null) {
  if (!value) return "—";
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  const seconds = value.seconds ?? value._seconds;
  return typeof seconds === "number" ? new Date(seconds * 1000).toLocaleString() : "—";
}

export function MarkAttendance({ employees, initialDate, initialEmployeeId, editRequest }: Props) {
  const { branchId } = useAuth();
  const { notify } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const [timeZone, setTimeZone] = useState("Asia/Colombo");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "");
  const [date, setDate] = useState(initialDate ?? dateInTimeZone("Asia/Colombo"));
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [note, setNote] = useState("");
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    void getDoc(doc(db, "branches", branchId)).then((snapshot) => {
      const branchTimeZone = snapshot.data()?.timezone;
      if (active && typeof branchTimeZone === "string" && branchTimeZone) {
        setTimeZone(branchTimeZone);
        if (!initialDate) setDate(dateInTimeZone(branchTimeZone));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [branchId, initialDate]);

  const loadRecords = useCallback(async () => {
    if (!branchId || !date) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await attendanceService.getAttendanceList({ month: date.slice(0, 7) });
      if (sequence !== requestSequence.current) return;
      setRecords(response.attendance.filter((record) => record.date === date && record.branchId === branchId));
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setRecords([]);
      setLoadError(error instanceof Error ? error.message : "Unable to load attendance.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [branchId, date]);

  useEffect(() => {
    setRecords([]);
    void loadRecords();
    return () => { requestSequence.current += 1; };
  }, [loadRecords]);

  const recordMap = useMemo(
    () => new Map(records.map((record) => [record.employeeId, record])),
    [records],
  );
  const selectedRecord = employeeId ? recordMap.get(employeeId) : undefined;

  useEffect(() => {
    if (!employeeId) {
      setStatus("");
      setNote("");
      return;
    }
    const existing = recordMap.get(employeeId);
    setStatus(existing?.status ?? "");
    setNote(existing?.note ?? "");
  }, [employeeId, recordMap]);

  useEffect(() => {
    if (!editRequest) return;
    setDate(editRequest.date);
    setEmployeeId(editRequest.employeeId);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [editRequest]);

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [employeeId, employees]);

  const selectEmployee = (id: string, defaultPresent = false) => {
    setEmployeeId(id);
    const existing = recordMap.get(id);
    setStatus(existing?.status ?? (defaultPresent ? "present" : ""));
    setNote(existing?.note ?? "");
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function saveAttendance() {
    if (!employeeId || !status || !date || saving) {
      if (!saving) notify("Select an employee, date, and status before saving.", "error");
      return;
    }
    const updating = !!selectedRecord;
    setSaving(true);
    try {
      await attendanceService.createAttendance({ employeeId, date, status, note: note.trim() });
      await loadRecords();
      notify(
        updating ? "Attendance updated successfully." : "Attendance saved successfully.",
        "success",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save attendance.", "error");
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    const priority = { not_marked: 0, on_leave: 1, present: 2 } as const;
    return employees
      .map((employee) => {
        const record = recordMap.get(employee.id) ?? null;
        return { employee, record, displayStatus: record?.status ?? "not_marked" as const };
      })
      .filter((row) => filter === "all" || row.displayStatus === filter)
      .filter((row) => {
        const query = search.trim().toLowerCase();
        return !query || employeeName(row.employee).toLowerCase().includes(query) || row.employee.email.toLowerCase().includes(query);
      })
      .sort((a, b) => priority[a.displayStatus] - priority[b.displayStatus] || employeeName(a.employee).localeCompare(employeeName(b.employee)));
  }, [employees, filter, recordMap, search]);

  const marked = records.length;
  const present = records.filter((record) => record.status === "present").length;
  const onLeave = records.filter((record) => record.status === "on_leave").length;
  const today = dateInTimeZone(timeZone);

  return (
    <div className="space-y-4">
      <div ref={formRef} className="card scroll-mt-24 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-burgundy-600">
              <CalendarCheck2 size={18} />
              <h2 className="text-lg font-semibold text-ink">Mark attendance</h2>
            </div>
            <p className="mt-1 text-sm text-ink-soft">Record or update an employee’s attendance for the selected date.</p>
          </div>
          {selectedRecord && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-burgundy-50 px-3 py-1 text-xs font-semibold text-burgundy-700">
              <CheckCircle2 size={13} /> Already recorded
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EmployeeSelector
            label="Employee"
            value={employeeId}
            options={employees.map((employee) => ({
              id: employee.id,
              label: `${employeeName(employee)} — ${employee.email}`,
            }))}
            onChange={setEmployeeId}
          />
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400 focus:ring-2 focus:ring-burgundy-100" />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Status</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["present", "on_leave"] as AttendanceStatus[]).map((value) => (
              <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-500 ${status === value ? value === "present" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-amber-500 bg-amber-50 text-amber-700" : "border-line bg-white text-ink-soft hover:bg-surface-muted"}`}>
                {value === "present" ? "Present" : "On leave"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex flex-col gap-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">Note <span className="font-normal text-ink-faint">(optional)</span></span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add an optional note" className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-burgundy-400 focus:ring-2 focus:ring-burgundy-100" />
        </label>

        <button type="button" onClick={saveAttendance} disabled={saving || !employeeId || !status || !date} className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto">
          <Save size={16} />
          {saving ? (selectedRecord ? "Updating..." : "Saving...") : selectedRecord ? "Update attendance" : "Save attendance"}
        </button>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{date === today ? "Today’s attendance" : `Attendance for ${formatSelectedDate(date)}`}</h2>
              <p className="mt-1 text-sm text-ink-soft">Live attendance status for the selected date.</p>
            </div>
            <button type="button" onClick={() => void loadRecords()} disabled={loading} aria-label="Refresh attendance" className="btn-ghost p-2">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
          <SummaryCard label="Total employees" value={employees.length} />
          <SummaryCard label="Marked" value={marked} tone="blue" />
          <SummaryCard label="Present" value={present} tone="green" />
          <SummaryCard label="On leave" value={onLeave} tone="amber" />
          <SummaryCard label="Not marked" value={Math.max(0, employees.length - marked)} />
        </div>

        <div className="flex flex-col gap-3 border-y border-line bg-surface-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Attendance status filter">
            {(["all", "not_marked", "present", "on_leave"] as Filter[]).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === value ? "bg-burgundy-600 text-white" : "border border-line bg-white text-ink-soft hover:text-ink"}`}>
                {value === "all" ? "All" : value === "not_marked" ? "Not marked" : value === "present" ? "Present" : "On leave"}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search employees</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-burgundy-400" />
          </label>
        </div>

        {loading ? (
          <CenterSpinner label="Loading attendance" />
        ) : loadError ? (
          <div className="p-5 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <button type="button" onClick={() => void loadRecords()} className="btn-ghost mt-3">Retry</button>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState title="No active employees were found for this branch." />
        ) : rows.length === 0 ? (
          <EmptyState title="No employees match this filter." />
        ) : (
          <div className="divide-y divide-line">
            {rows.map(({ employee, record, displayStatus }) => {
              const name = employeeName(employee);
              const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
              return (
                <div key={employee.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy-50 text-xs font-bold text-burgundy-700">{initials || "?"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="truncate text-xs text-ink-faint">{employee.email} · {employee.role}</p>
                    </div>
                  </div>
                  <div className="sm:w-48">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${displayStatus === "present" ? "bg-emerald-50 text-emerald-700" : displayStatus === "on_leave" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                      {displayStatus === "present" ? "Present" : displayStatus === "on_leave" ? "On leave" : "Not marked"}
                    </span>
                    {record?.note && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{record.note}</p>}
                  </div>
                  <p className="text-xs text-ink-faint sm:w-40">{record ? `Updated ${formatTimestamp(record.updatedAt ?? record.createdAt)}` : "No record"}</p>
                  <button type="button" onClick={() => selectEmployee(employee.id, !record)} className="btn-ghost inline-flex min-h-10 items-center justify-center gap-2 sm:shrink-0" aria-label={`${record ? "Edit" : "Mark"} attendance for ${name}`}>
                    <Pencil size={14} /> {record ? "Edit" : "Mark"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!loading && !loadError && employees.length > 0 && records.length === 0 && (
          <p className="border-t border-line bg-amber-50 px-5 py-3 text-sm text-amber-800">
            No attendance has been marked for this date yet. Use Mark to record each employee.
          </p>
        )}
      </section>
    </div>
  );
}
