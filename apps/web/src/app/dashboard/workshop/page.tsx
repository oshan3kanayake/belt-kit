"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Car,
  User,
  Users,
  AlertCircle,
  Clock,
  Edit2,
  Search,
  Kanban,
  ChevronRight,
  Wrench,
  Loader2,
} from "lucide-react";
import { useCollection, where } from "@/lib/useCollection";
import { updateDocById } from "@/lib/db-write";
import {
  JobCard,
  Customer,
  Vehicle,
  JobStatus,
  JOB_STATUS_META,
  JOB_STATUS_ORDER,
} from "@/lib/models";
import { useAuth } from "@/lib/auth-context";
import {
  CenterSpinner,
  EmptyState,
  Badge,
  Modal,
  useToast,
  Field,
  PageHeader,
} from "@/components/ui";

/* ── Status column accent colors ──────────────────────────────────────── */
const STATUS_COLORS: Record<JobStatus, { bg: string; border: string; dot: string; headerBg: string }> = {
  booked:         { bg: "bg-slate-50",   border: "border-slate-200",  dot: "bg-slate-400",   headerBg: "bg-slate-100" },
  in_progress:    { bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500",    headerBg: "bg-blue-100" },
  awaiting_parts: { bg: "bg-amber-50",   border: "border-amber-200",  dot: "bg-amber-500",   headerBg: "bg-amber-100" },
  qc:             { bg: "bg-purple-50",  border: "border-purple-200", dot: "bg-purple-500",  headerBg: "bg-purple-100" },
  ready:          { bg: "bg-emerald-50", border: "border-emerald-200",dot: "bg-emerald-500", headerBg: "bg-emerald-100" },
  delivered:      { bg: "bg-rose-50",    border: "border-rose-200",   dot: "bg-rose-500",    headerBg: "bg-rose-100" },
};

const WORKSHOP_STATUSES: JobStatus[] = [
  "booked",
  "in_progress",
  "awaiting_parts",
  "qc",
  "ready",
];

export default function WorkshopBoardPage() {
  const { role } = useAuth();
  const { notify } = useToast();

  const { data: jobs, loading: jobsLoading } = useCollection<JobCard>("jobCards", [
    where("archived", "!=", true),
  ]);
  const { data: vehicles } = useCollection<Vehicle>("vehicles");
  const { data: customers } = useCollection<Customer>("customers");
  const { data: staff } = useCollection<{ id: string; displayName?: string; email?: string }>("users");

  const [searchTerm, setSearchTerm] = useState("");
  const [editingDelayJob, setEditingDelayJob] = useState<(JobCard & { id: string }) | null>(null);
  const [delayNoteText, setDelayNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const canEdit = role === "owner" || role === "manager" || role === "advisor" || role === "technician";

  // Filter active jobs
  const filteredJobs = jobs.filter((job) => {
    if (job.status === "delivered") return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const veh = vehicles.find((v) => v.id === job.vehicleId);
    const cust = customers.find((c) => c.id === job.customerId);

    return (
      (job.complaint || "").toLowerCase().includes(term) ||
      (veh?.plateNumber || "").toLowerCase().includes(term) ||
      (veh?.make || "").toLowerCase().includes(term) ||
      (veh?.model || "").toLowerCase().includes(term) ||
      (cust?.displayName || "").toLowerCase().includes(term)
    );
  });

  const totalActive = filteredJobs.length;

  async function handleSaveDelayNote() {
    if (!editingDelayJob || !editingDelayJob.id || !canEdit) return;
    setSavingNote(true);
    try {
      await updateDocById("jobCards", editingDelayJob.id, {
        delayNote: delayNoteText.trim() || null,
      });
      notify("Delay note updated.");
      setEditingDelayJob(null);
    } catch {
      notify("Could not update delay note.", "error");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleQuickStatusChange(jobId: string, nextStatus: JobStatus) {
    if (!canEdit) return;
    try {
      await updateDocById("jobCards", jobId, { status: nextStatus });
      notify(`Status → ${JOB_STATUS_META[nextStatus].label}`);
    } catch {
      notify("Could not update status.", "error");
    }
  }

  if (jobsLoading) return <CenterSpinner label="Loading workshop board…" />;

  return (
    <div className="space-y-6">
      {/* ── Header (matches other pages) ──────────────────────────────── */}
      <PageHeader
        eyebrow="Workshop"
        title="Workshop Board"
        icon={Kanban}
        action={
          <div className="relative w-full sm:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vehicle, plate, customer…"
              className="input-luxe pl-10 text-sm"
            />
          </div>
        }
      />

      {/* ── Status Summary Chips ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {WORKSHOP_STATUSES.map((statusKey) => {
          const count = filteredJobs.filter((j) => j.status === statusKey).length;
          const colors = STATUS_COLORS[statusKey];
          const meta = JOB_STATUS_META[statusKey];
          return (
            <div
              key={statusKey}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${colors.border} ${colors.bg}`}
            >
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className="text-ink">{meta.label}</span>
              <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft shadow-xs">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Kanban Columns ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5 items-start">
        {WORKSHOP_STATUSES.map((statusKey) => {
          const columnJobs = filteredJobs.filter((j) => j.status === statusKey);
          const meta = JOB_STATUS_META[statusKey];
          const colors = STATUS_COLORS[statusKey];

          return (
            <div
              key={statusKey}
              className="flex flex-col rounded-2xl border border-line/60 bg-white shadow-sm overflow-hidden"
              style={{ minHeight: "420px" }}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-4 py-3 ${colors.headerBg} border-b ${colors.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${colors.dot} ring-2 ring-white shadow-sm`} />
                  <span className="text-sm font-bold text-ink">{meta.label}</span>
                </div>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink shadow-xs`}>
                  {columnJobs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2.5 overflow-y-auto p-3 max-h-[calc(100vh-320px)]">
                {columnJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line/60 bg-surface-muted/20 p-8 text-center">
                    <Car size={20} className="text-ink-faint/40 mb-1.5" />
                    <p className="text-[11px] text-ink-faint">No vehicles</p>
                  </div>
                ) : (
                  columnJobs.map((job) => {
                    const vehicle = vehicles.find((v) => v.id === job.vehicleId);
                    const customer = customers.find((c) => c.id === job.customerId);
                    const techNames = (job.assignedTechnicianIds || [])
                      .map((uid) => staff.find((s) => s.id === uid)?.displayName || uid.slice(0, 6))
                      .join(", ");

                    return (
                      <div
                        key={job.id}
                        className={`group relative rounded-xl border bg-white p-3.5 transition-all duration-200 hover:shadow-md ${colors.border} hover:border-burgundy-300`}
                      >
                        {/* Top color accent bar */}
                        <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-b-full ${colors.dot} opacity-60`} />

                        {/* Vehicle + Plate */}
                        <div className="flex items-start justify-between gap-1.5 mt-0.5">
                          <Link
                            href={`/dashboard/job-cards/${job.id}`}
                            className="text-sm font-bold text-ink hover:text-burgundy-600 transition-colors line-clamp-1 flex-1"
                          >
                            {vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle"}
                          </Link>
                          {vehicle?.plateNumber && (
                            <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white tracking-wider">
                              {vehicle.plateNumber}
                            </span>
                          )}
                        </div>

                        {/* Complaint */}
                        <p className="mt-1.5 text-[12px] text-ink-soft line-clamp-2 leading-relaxed">
                          {job.complaint}
                        </p>

                        {/* Info rows */}
                        <div className="mt-3 space-y-1.5">
                          {customer && (
                            <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                              <User size={11} className="text-burgundy-400 shrink-0" />
                              <span className="truncate">{customer.displayName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                            <Wrench size={11} className="text-burgundy-400 shrink-0" />
                            <span className="truncate font-medium">
                              {techNames || "Unassigned"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                            <Clock size={11} className="text-amber-500 shrink-0" />
                            <span>
                              {job.promisedEndDate
                                ? new Date(job.promisedEndDate.toDate()).toLocaleDateString()
                                : job.scheduledDate
                                ? new Date(job.scheduledDate.toDate()).toLocaleDateString()
                                : "No date set"}
                            </span>
                          </div>
                        </div>

                        {/* Delay Note */}
                        {job.delayNote && (
                          <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200/60 p-2 text-[11px] text-amber-800">
                            <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">{job.delayNote}</span>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="mt-3 pt-2.5 border-t border-line/50 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setEditingDelayJob(job);
                              setDelayNoteText(job.delayNote || "");
                            }}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint hover:text-burgundy-600 hover:bg-burgundy-50 transition-all"
                          >
                            <Edit2 size={10} />
                            {job.delayNote ? "Edit" : "+ Note"}
                          </button>

                          {canEdit && (
                            <select
                              value={job.status}
                              onChange={(e) =>
                                handleQuickStatusChange(job.id, e.target.value as JobStatus)
                              }
                              className="rounded-lg border border-line/80 bg-surface-muted/50 px-2 py-0.5 text-[10px] font-semibold text-ink focus:border-burgundy-400 focus:outline-none cursor-pointer"
                            >
                              {JOB_STATUS_ORDER.map((st) => (
                                <option key={st} value={st}>
                                  {JOB_STATUS_META[st].label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Hover arrow to job card */}
                        <Link
                          href={`/dashboard/job-cards/${job.id}`}
                          className="absolute top-3 right-3 rounded-full bg-burgundy-600 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          title="Open job card"
                        >
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Delay Note Modal ───────────────────────────────────────────── */}
      {editingDelayJob && (
        <Modal
          open={!!editingDelayJob}
          onClose={() => setEditingDelayJob(null)}
          title="Delay Note / Remarks"
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Add a delay reason or progress note visible on the workshop board.
            </p>
            <Field label="Note">
              <textarea
                value={delayNoteText}
                onChange={(e) => setDelayNoteText(e.target.value)}
                placeholder="e.g. Waiting for alternator part delivery…"
                rows={3}
                className="input-luxe"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingDelayJob(null)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDelayNote}
                disabled={savingNote}
                className="btn-primary"
              >
                {savingNote ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Save Note"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
