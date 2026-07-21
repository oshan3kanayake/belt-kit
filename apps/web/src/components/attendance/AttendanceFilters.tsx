"use client";

import { CalendarDays, RotateCcw } from "lucide-react";

type AttendanceFiltersProps = {
  selectedDate: string;
  selectedMonth: string;
  onDateChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onClear: () => void;
  loading?: boolean;
};

function formatMonthValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function AttendanceFilters({
  selectedDate,
  selectedMonth,
  onDateChange,
  onMonthChange,
  onClear,
  loading,
}: AttendanceFiltersProps) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">Month</span>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <CalendarDays size={16} className="text-ink-faint" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => onMonthChange(event.target.value)}
                className="w-full border-none bg-transparent outline-none"
                disabled={loading}
              />
            </div>
          </label>

          <label className="flex flex-1 flex-col gap-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">Date</span>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <CalendarDays size={16} className="text-ink-faint" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => onDateChange(event.target.value)}
                className="w-full border-none bg-transparent outline-none"
                disabled={loading}
              />
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-burgundy-300 hover:text-burgundy-600"
          disabled={loading}
        >
          <RotateCcw size={15} />
          Clear filters
        </button>
      </div>
    </div>
  );
}
