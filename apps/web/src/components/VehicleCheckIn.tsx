"use client";

import { useState, useEffect } from "react";
import { Gauge, Fuel, AlertTriangle, Save } from "lucide-react";
import { JobCard } from "@/lib/models";
import { updateDocById } from "@/lib/db-write";
import { useToast, Field } from "@/components/ui";

interface VehicleCheckInProps {
  job: JobCard;
  jobId: string;
  canEdit: boolean;
}

export function VehicleCheckIn({ job, jobId, canEdit }: VehicleCheckInProps) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const [odometer, setOdometer] = useState<string>(
    job.odometerReading !== undefined && job.odometerReading !== null
      ? String(job.odometerReading)
      : ""
  );
  const [fuelLevel, setFuelLevel] = useState<string>(job.fuelLevel || "Half");
  const [scratches, setScratches] = useState<boolean>(
    job.existingDamage?.scratches || false
  );
  const [dents, setDents] = useState<boolean>(
    job.existingDamage?.dents || false
  );
  const [crackedGlass, setCrackedGlass] = useState<boolean>(
    job.existingDamage?.crackedGlass || false
  );
  const [damageNotes, setDamageNotes] = useState<string>(
    job.existingDamage?.notes || ""
  );

  useEffect(() => {
    setOdometer(
      job.odometerReading !== undefined && job.odometerReading !== null
        ? String(job.odometerReading)
        : ""
    );
    setFuelLevel(job.fuelLevel || "Half");
    setScratches(job.existingDamage?.scratches || false);
    setDents(job.existingDamage?.dents || false);
    setCrackedGlass(job.existingDamage?.crackedGlass || false);
    setDamageNotes(job.existingDamage?.notes || "");
  }, [job]);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const odoNum = odometer.trim() !== "" ? Number(odometer) : null;
      await updateDocById("jobCards", jobId, {
        odometerReading: odoNum,
        fuelLevel,
        existingDamage: {
          scratches,
          dents,
          crackedGlass,
          notes: damageNotes.trim(),
        },
      });
      notify("Vehicle check-in record saved.");
    } catch {
      notify("Could not save check-in record.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-burgundy-50 text-burgundy-600">
            <Gauge size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Vehicle Check-in / Inspection</h3>
            <p className="text-xs text-ink-soft">Record condition at arrival to document existing damage</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Save size={14} className="animate-spin" /> : <Save size={14} />}
            Save Check-in
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Odometer Reading */}
        <Field label="Odometer Reading (km / miles)">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
              <Gauge size={16} />
            </div>
            <input
              type="number"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. 45200"
              className="input-luxe pl-10"
            />
          </div>
        </Field>

        {/* Fuel Level */}
        <Field label="Fuel Level at Arrival">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
              <Fuel size={16} />
            </div>
            <select
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value)}
              disabled={!canEdit}
              className="input-luxe pl-10"
            >
              <option value="Empty">Empty (Reserve)</option>
              <option value="Quarter">Quarter Tank (1/4)</option>
              <option value="Half">Half Tank (1/2)</option>
              <option value="Full">Full Tank (1/1)</option>
            </select>
          </div>
        </Field>
      </div>

      {/* Existing Damage Checklist */}
      <div className="mt-5 rounded-xl border border-line bg-surface-muted/50 p-4">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft mb-3">
          <AlertTriangle size={14} className="text-amber-500" />
          Existing Damage Checklist
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 cursor-pointer hover:border-burgundy-300 transition-all shadow-xs">
            <input
              type="checkbox"
              checked={scratches}
              onChange={(e) => setScratches(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-line text-burgundy-600 focus:ring-burgundy-500"
            />
            <span className="text-sm font-medium text-ink">Scratches</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 cursor-pointer hover:border-burgundy-300 transition-all shadow-xs">
            <input
              type="checkbox"
              checked={dents}
              onChange={(e) => setDents(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-line text-burgundy-600 focus:ring-burgundy-500"
            />
            <span className="text-sm font-medium text-ink">Dents / Dings</span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 cursor-pointer hover:border-burgundy-300 transition-all shadow-xs">
            <input
              type="checkbox"
              checked={crackedGlass}
              onChange={(e) => setCrackedGlass(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-line text-burgundy-600 focus:ring-burgundy-500"
            />
            <span className="text-sm font-medium text-ink">Cracked Glass</span>
          </label>
        </div>

        {/* Damage Notes */}
        <div className="mt-3">
          <textarea
            value={damageNotes}
            onChange={(e) => setDamageNotes(e.target.value)}
            disabled={!canEdit}
            placeholder="Add detailed notes about existing damage (e.g. rear bumper scratch left side)..."
            rows={2}
            className="input-luxe"
          />
        </div>
      </div>
    </div>
  );
}
