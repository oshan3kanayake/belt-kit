"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Timestamp } from "firebase/firestore";
import {
  ClipboardList,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Car,
  User,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { createDoc } from "@/lib/db-write";
import {
  JobCard,
  Customer,
  Vehicle,
  JobStatus,
  JOB_STATUS_META,
  JOB_STATUS_ORDER,
} from "@/lib/models";
import { formatMoney, formatDate } from "@/lib/format";
import {
  PageHeader,
  Modal,
  Field,
  TableSkeleton,
  EmptyState,
  Badge,
  DataTable,
  Column,
  FilterChips,
  SearchInput,
  useToast,
} from "@/components/ui";

export default function JobCardsPage() {
  const { branchId, role } = useAuth();
  const router = useRouter();
  const { data: allJobs, loading, error } = useCollection<JobCard>("jobCards");
  const jobs =
    role === "technician"
      ? allJobs.filter((j) =>
          (j.assignedTechnicianIds || []).includes(auth.currentUser?.uid ?? "")
        )
      : allJobs;
  const { data: customers } = useCollection<Customer>("customers");
  const { data: vehicles } = useCollection<Vehicle>("vehicles");
  const { notify } = useToast();

  const [view, setView] = useState<"board" | "list">("board");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");

  const canCreate = role === "owner" || role === "manager" || role === "advisor";

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.displayName ?? "—";
  const vehicleLabel = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.make} ${v.model} · ${v.plateNumber}` : "—";
  };

  const modalVehicles = useMemo(
    () => vehicles.filter((v) => v.customerId === selectedCustomer),
    [vehicles, selectedCustomer]
  );

  // Search across complaint, customer name and vehicle label.
  const searched = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.complaint?.toLowerCase().includes(q) ||
        customerName(j.customerId).toLowerCase().includes(q) ||
        vehicleLabel(j.vehicleId).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, search, customers, vehicles]);

  const byStatus = useMemo(() => {
    const map: Record<JobStatus, (JobCard & { id: string })[]> = {
      booked: [],
      in_progress: [],
      awaiting_parts: [],
      qc: [],
      ready: [],
      delivered: [],
    };
    searched.forEach((j) => map[j.status]?.push(j));
    return map;
  }, [searched]);

  const listRows = useMemo(
    () =>
      statusFilter === "all"
        ? searched
        : searched.filter((j) => j.status === statusFilter),
    [searched, statusFilter]
  );

  const columns: Column<JobCard & { id: string }>[] = [
    {
      key: "complaint",
      header: "Complaint",
      sortValue: (j) => j.complaint?.toLowerCase() ?? "",
      cell: (j) => (
        <span className="font-medium text-ink group-hover:text-burgundy-600 line-clamp-1">
          {j.complaint}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortValue: (j) => customerName(j.customerId).toLowerCase(),
      hideBelow: "sm",
      cell: (j) => (
        <span className="flex items-center gap-1.5 text-ink-soft">
          <User size={13} className="text-ink-faint" /> {customerName(j.customerId)}
        </span>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      hideBelow: "lg",
      cell: (j) => (
        <span className="flex items-center gap-1.5 text-ink-soft">
          <Car size={13} className="text-ink-faint" /> {vehicleLabel(j.vehicleId)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (j) => JOB_STATUS_ORDER.indexOf(j.status),
      cell: (j) => (
        <Badge tone={JOB_STATUS_META[j.status].tone}>
          {JOB_STATUS_META[j.status].label}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Opened",
      sortValue: (j) => j.createdAt?.toMillis?.() ?? 0,
      hideBelow: "md",
      cell: (j) => (
        <span className="text-xs text-ink-faint">{formatDate(j.createdAt)}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (j) => j.totalMinor,
      cell: (j) => (
        <span className="font-medium text-ink">{formatMoney(j.totalMinor)}</span>
      ),
    },
  ];

  async function handleCreate(form: FormData) {
    if (!branchId) return;
    setSaving(true);
    const dateStr = String(form.get("scheduledDate") || "");
    const payload = {
      customerId: String(form.get("customerId") || ""),
      vehicleId: String(form.get("vehicleId") || ""),
      complaint: String(form.get("complaint") || "").trim(),
      status: "booked" as JobStatus,
      assignedTechnicianIds: [] as string[],
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
      invoiceId: null,
      scheduledDate: dateStr ? Timestamp.fromDate(new Date(dateStr)) : null,
    };
    if (!payload.customerId || !payload.vehicleId || !payload.complaint) {
      notify("Customer, vehicle and complaint are required.", "error");
      setSaving(false);
      return;
    }
    try {
      const ref = await createDoc("jobCards", branchId, payload);
      notify("Job card created — now add parts, labor and pricing.");
      setModalOpen(false);
      setSelectedCustomer("");
      // Take them straight into the job so it's obvious what to do next.
      router.push(`/dashboard/job-cards/${ref.id}`);
    } catch {
      notify("Could not create job card.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Operations"
        title="Job Cards"
        icon={ClipboardList}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-line bg-surface p-1">
              <button
                onClick={() => setView("board")}
                className={`rounded-lg p-2 transition ${
                  view === "board"
                    ? "bg-burgundy-600 text-white"
                    : "text-ink-soft hover:text-burgundy-600"
                }`}
                aria-label="Board view"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`rounded-lg p-2 transition ${
                  view === "list"
                    ? "bg-burgundy-600 text-white"
                    : "text-ink-soft hover:text-burgundy-600"
                }`}
                aria-label="List view"
              >
                <ListIcon size={18} />
              </button>
            </div>
            {canCreate && (
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus size={18} /> New Job
              </button>
            )}
          </div>
        }
      />

      {/* Search + status filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {view === "list" && jobs.length > 0 ? (
          <FilterChips
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All", count: searched.length },
              ...JOB_STATUS_ORDER.map((s) => ({
                value: s,
                label: JOB_STATUS_META[s].label,
                count: byStatus[s].length,
              })),
            ]}
          />
        ) : (
          <span />
        )}
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search complaint, customer or vehicle…"
          className="w-full sm:max-w-xs"
        />
      </div>

      {!loading && jobs.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-burgundy-100 bg-burgundy-50/50 px-4 py-3 text-sm text-ink-soft">
          <ClipboardList size={16} className="shrink-0 text-burgundy-600" />
          Select a job card to add work, set pricing and generate its invoice.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-burgundy-50 px-4 py-3 font-sans text-sm text-burgundy-600">
          {error}
        </div>
      )}

      {loading ? (
        view === "list" ? (
          <TableSkeleton cols={6} />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {JOB_STATUS_ORDER.map((s) => (
              <div key={s} className="w-72 shrink-0 space-y-2">
                <TableSkeleton cols={1} rows={3} />
              </div>
            ))}
          </div>
        )
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No job cards yet"
          hint="Open a job card when a vehicle comes in for work."
          action={
            canCreate && (
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus size={18} /> New Job
              </button>
            )
          }
        />
      ) : searched.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No matches"
          hint="No job cards match your search."
        />
      ) : view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {JOB_STATUS_ORDER.map((status) => (
            <div key={status} className="w-72 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <Badge tone={JOB_STATUS_META[status].tone}>
                  {JOB_STATUS_META[status].label}
                </Badge>
                <span className="font-sans text-xs text-ink-faint">
                  {byStatus[status].length}
                </span>
              </div>
              <div className="space-y-2">
                {byStatus[status].map((j) => (
                  <motion.div
                    key={j.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link
                      href={`/dashboard/job-cards/${j.id}`}
                      className="card block cursor-pointer p-4 transition hover:border-burgundy-300 hover:shadow-luxe focus:outline-none focus:ring-2 focus:ring-burgundy-300"
                    >
                      <p className="line-clamp-2 font-sans text-sm font-medium text-ink">
                        {j.complaint}
                      </p>
                      <div className="mt-2.5 space-y-1 font-sans text-xs text-ink-soft">
                        <p className="flex items-center gap-1.5">
                          <User size={12} /> {customerName(j.customerId)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Car size={12} /> {vehicleLabel(j.vehicleId)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                        <span className="font-sans text-xs text-ink-faint">
                          {formatDate(j.createdAt)}
                        </span>
                        <span className="font-sans text-sm font-semibold text-burgundy-600">
                          {formatMoney(j.totalMinor)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold text-burgundy-600">
                        <span>Open job card</span><ArrowRight size={14} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
                {byStatus[status].length === 0 && (
                  <div className="rounded-xl border border-dashed border-line py-6 text-center font-sans text-xs text-ink-faint">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          rows={listRows}
          columns={columns}
          initialSort={{ key: "date", dir: "desc" }}
          onRowClick={(j) => router.push(`/dashboard/job-cards/${j.id}`)}
          emptyState={
            <EmptyState
              icon={ClipboardList}
              title="No matching job cards"
              hint="Try a different status filter."
            />
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCustomer("");
        }}
        title="New Job Card"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <Field label="Customer" required>
            <select
              name="customerId"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="input-luxe"
            >
              <option value="" disabled>
                Select a customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} · {c.phone}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Vehicle"
            required
            hint={
              selectedCustomer && modalVehicles.length === 0
                ? "This customer has no vehicles — add one first."
                : undefined
            }
          >
            <select
              name="vehicleId"
              className="input-luxe"
              disabled={!selectedCustomer}
            >
              <option value="" disabled selected>
                {selectedCustomer ? "Select a vehicle…" : "Pick a customer first"}
              </option>
              {modalVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} · {v.plateNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Complaint / work requested" required>
            <textarea
              name="complaint"
              rows={3}
              className="input-luxe resize-none"
              placeholder="e.g. Brake noise on front left, service due"
            />
          </Field>
          <Field label="Scheduled date" hint="Optional — shows on the dashboard calendar.">
            <input name="scheduledDate" type="date" className="input-luxe" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setSelectedCustomer("");
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create job card"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
