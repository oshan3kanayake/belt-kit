"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Car, ClipboardList, User } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection, where } from "@/lib/useCollection";
import { Vehicle, Customer, JobCard, JOB_STATUS_META } from "@/lib/models";
import { formatDate, formatMoney } from "@/lib/format";
import { CenterSpinner, EmptyState, Badge } from "@/components/ui";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: jobs } = useCollection<JobCard>("jobCards", [
    where("vehicleId", "==", id),
  ]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "vehicles", id));
      if (snap.exists()) {
        const v = snap.data() as Vehicle;
        setVehicle(v);
        if (v.customerId) {
          const cs = await getDoc(doc(db, "customers", v.customerId));
          if (cs.exists()) setCustomer(cs.data() as Customer);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <CenterSpinner label="Loading vehicle…" />;
  if (!vehicle)
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Vehicle not found" hint="It may have been archived." />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => router.push("/dashboard/vehicles")}
        className="mb-6 flex items-center gap-2 font-sans text-sm text-ink-soft transition hover:text-burgundy-600"
      >
        <ArrowLeft size={16} /> All vehicles
      </button>

      <div className="card mb-6 p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-burgundy-deep text-white shadow-luxe">
            <Car size={34} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold text-burgundy-700">
                {vehicle.make} {vehicle.model}
              </h1>
              <span className="rounded-lg bg-burgundy-deep px-2.5 py-1 font-sans text-xs font-semibold uppercase tracking-wider text-white">
                {vehicle.plateNumber}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm text-ink-soft">
              {vehicle.year && <span>Year {vehicle.year}</span>}
              {vehicle.vin && <span>VIN {vehicle.vin}</span>}
              {vehicle.engine && <span>Engine {vehicle.engine}</span>}
            </div>
            {customer && (
              <Link
                href={`/dashboard/customers/${vehicle.customerId}`}
                className="mt-3 inline-flex items-center gap-1.5 font-sans text-sm text-burgundy-600 hover:text-burgundy-700"
              >
                <User size={14} /> {customer.displayName}
              </Link>
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold text-ink">
          <ClipboardList size={20} className="text-rosegold-500" /> Service history
        </h2>
        {jobs.length === 0 ? (
          <EmptyState
            title="No service history"
            hint="Jobs opened for this vehicle will appear here."
          />
        ) : (
          <div className="space-y-2">
            {jobs
              .slice()
              .sort(
                (a, b) =>
                  (b.createdAt?.toMillis?.() ?? 0) -
                  (a.createdAt?.toMillis?.() ?? 0)
              )
              .map((j) => (
                <Link
                  key={j.id}
                  href={`/dashboard/job-cards/${j.id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-luxe"
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans font-medium text-ink">
                      {j.complaint || "Job card"}
                    </p>
                    <p className="font-sans text-xs text-ink-faint">
                      {formatDate(j.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-sans text-sm font-medium text-ink">
                      {formatMoney(j.totalMinor)}
                    </span>
                    <Badge tone={JOB_STATUS_META[j.status]?.tone ?? "neutral"}>
                      {JOB_STATUS_META[j.status]?.label ?? j.status}
                    </Badge>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
