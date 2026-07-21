"use client";

type AttendanceStatusSelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AttendanceStatusSelector({ value, onChange }: AttendanceStatusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => onChange("present")}
        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${value === "present" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink-soft"}`}
      >
        Present
      </button>
      <button
        type="button"
        onClick={() => onChange("on_leave")}
        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${value === "on_leave" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-line bg-white text-ink-soft"}`}
      >
        On Leave
      </button>
    </div>
  );
}
