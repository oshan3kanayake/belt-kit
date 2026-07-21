"use client";

import { Check, Minus } from "lucide-react";

type AttendanceStatusCheckboxProps = {
  checked: boolean;
  loading?: boolean;
  onChange: (checked: boolean) => void;
};

export function AttendanceStatusCheckbox({ checked, loading, onChange }: AttendanceStatusCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={loading}
      className={`flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition ${checked ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink-soft"} ${loading ? "cursor-not-allowed opacity-70" : "hover:border-emerald-400 hover:bg-emerald-50"}`}
      aria-pressed={checked}
    >
      {checked ? <Check size={16} /> : <Minus size={16} />}
      <span className="ml-2">{checked ? "Present" : "On leave"}</span>
    </button>
  );
}
