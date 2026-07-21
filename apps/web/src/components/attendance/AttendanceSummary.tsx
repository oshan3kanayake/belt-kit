"use client";

import { CalendarDays, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

type AttendanceSummaryData = {
  presentDays: number;
  leaveDays: number;
  totalDays: number;
  attendanceRate: number;
};

type AttendanceSummaryProps = {
  month: string;
  summary: AttendanceSummaryData;
  loading?: boolean;
};

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split("-");
  const date = new Date(Number(year), Number(monthIndex) - 1, 1);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

export function AttendanceSummary({ month, summary, loading }: AttendanceSummaryProps) {
  const cards = [
    {
      label: "Present Days",
      value: summary.presentDays,
      icon: CheckCircle2,
      tone: "green",
    },
    {
      label: "Leave Days",
      value: summary.leaveDays,
      icon: XCircle,
      tone: "amber",
    },
    {
      label: "Total Days",
      value: summary.totalDays,
      icon: CalendarDays,
      tone: "blue",
    },
    {
      label: "Attendance Rate",
      value: `${summary.attendanceRate.toFixed(0)}%`,
      icon: TrendingUp,
      tone: "burgundy",
    },
  ];

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-faint">
            Monthly snapshot
          </p>
          <h2 className="text-lg font-semibold text-ink">{formatMonthLabel(month)} Attendance</h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-line bg-surface-muted/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-soft">{label}</p>
              <div className={`rounded-lg p-2 ${tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "blue" ? "bg-sky-50 text-sky-600" : "bg-burgundy-50 text-burgundy-600"}`}>
                <Icon size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              {loading ? "—" : value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
