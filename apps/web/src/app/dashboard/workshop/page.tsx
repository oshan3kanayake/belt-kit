"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Car,
  User,
  Users,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  Edit2,
  Check,
  Search,
  Filter,
  Kanban,
  ChevronRight,
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
} from "@/components/ui";

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

  // Filter active jobs by search query
  const filteredJobs = jobs.filter((job) => {
    if (job.status === "delivered") return false; // Hide delivered jobs from active workshop board
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

  async function handleSaveDelayNote() {
    if (!editingDelayJob || !editingDelayJob.id || !canEdit) return;
    setSavingNote(true);
    try {
      await updateDocById("jobCards", editingDelayJob.id, {
        delayNote: delayNoteText.trim() || null,
      });
      notify("Workshop delay note updated.");
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

  if (jobsLoading) return <CenterSpinner label="Loading live workshop board…" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-700 shadow-soft">
              <Kanban size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                Visual Workshop Board
              </h1>
              <p className="mt-0.5 text-sm text-ink-soft">
                Live vehicle tracking & progress across all garage bays
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vehicle, plate, or customer…"
            className="input-luxe pl-10"
          />
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:grid-cols-5 items-start">
        {WORKSHOP_STATUSES.map((statusKey) => {
          const columnJobs = filteredJobs.filter((j) => j.status === statusKey);
          const meta = JOB_STATUS_META[statusKey];

          return (
            <div
              key={statusKey}
              className="card flex flex-col rounded-2xl border border-line bg-white p-4 shadow-soft min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-line pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft">
                    {columnJobs.length}
                  </span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-0.5">
                {columnJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line/80 bg-surface-muted/30 p-6 text-center text-xs text-ink-faint">
                    No vehicles in {meta.label.toLowerCase()}
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
                        className="group relative rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-burgundy-300 hover:bg-white hover:shadow-luxe"
                      >
                        {/* Vehicle Title & Plate */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/dashboard/job-cards/${job.id}`}
                            className="font-bold text-sm text-ink hover:text-burgundy-600 transition-colors line-clamp-1 flex-1"
                          >
                            {vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle"}
                          </Link>
                          {vehicle?.plateNumber && (
                            <span className="shrink-0 rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-800">
                              {vehicle.plateNumber}
                            </span>
                          )}
                        </div>

                        {/* Complaint */}
                        <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                          {job.complaint}
                        </p>

                        {/* Customer */}
                        {customer && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                            <User size={13} className="text-burgundy-500 shrink-0" />
                            <span className="truncate">{customer.displayName}</span>
                          </div>
                        )}

                        {/* Assigned Techs */}
                        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                          <Users size={13} className="text-burgundy-400 shrink-0" />
                          <span className="truncate font-medium text-ink-soft">
                            {techNames ? techNames : "Unassigned"}
                          </span>
                        </div>

                        {/* Promised Date */}
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                          <Clock size={12} className="text-amber-500 shrink-0" />
                          <span>
                            {job.promisedEndDate
                              ? new Date(job.promisedEndDate.toDate()).toLocaleDateString()
                              : job.scheduledDate
                              ? new Date(job.scheduledDate.toDate()).toLocaleDateString()
                              : "No end date set"}
                          </span>
                        </div>

                        {/* Delay Note Alert Box */}
                        {job.delayNote && (
                          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-[11px] text-amber-900 shadow-xs">
                            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 font-medium">{job.delayNote}</span>
                          </div>
                        )}

                        {/* Actions Footer */}
                        <div className="mt-3.5 border-t border-line/80 pt-2.5 flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setEditingDelayJob(job);
                              setDelayNoteText(job.delayNote || "");
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-ink-faint hover:text-burgundy-600 transition-colors"
                          >
                            <Edit2 size={12} />
                            {job.delayNote ? "Edit Note" : "+ Note"}
                          </button>

                          {/* Quick advance status */}
                          {canEdit && (
                            <select
                              value={job.status}
                              onChange={(e) =>
                                handleQuickStatusChange(job.id, e.target.value as JobStatus)
                              }
                              className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink focus:border-burgundy-400 focus:outline-none shadow-xs"
                            >
                              {JOB_STATUS_ORDER.map((st) => (
                                <option key={st} value={st}>
                                  {JOB_STATUS_META[st].label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Delay Note Modal */}
      {editingDelayJob && (
        <Modal
          open={!!editingDelayJob}
          onClose={() => setEditingDelayJob(null)}
          title="Workshop Delay Note / Remarks"
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Add or update a delay reason or progress note for this vehicle.
            </p>
            <Field label="Delay Note / Remarks">
              <textarea
                value={delayNoteText}
                onChange={(e) => setDelayNoteText(e.target.value)}
                placeholder="e.g. Waiting for alternator part delivery from supplier..."
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
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
