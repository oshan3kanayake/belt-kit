"use client";

/**
 * Month calendar that marks days which have jobs (by scheduledDate, falling
 * back to createdAt). Click a day to see that day's jobs below.
 * Presentation-only — parent passes the jobs + a name resolver.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { JobCard, JOB_STATUS_META } from "@/lib/models";
import { VIZ } from "@/components/charts";

const STATUS_COLOR: Record<string, string> = {
  neutral: VIZ.slate,
  blue: VIZ.sky,
  amber: VIZ.amber,
  gold: VIZ.violet,
  green: VIZ.emerald,
  burgundy: VIZ.indigo,
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function jobDate(j: JobCard): Date | null {
  const t = j.scheduledDate?.toDate?.() ?? j.createdAt?.toDate?.();
  return t ?? null;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function JobsCalendar({
  jobs,
  customerName,
}: {
  jobs: (JobCard & { id: string })[];
  customerName: (id: string) => string;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  // Map YYYY-MM-DD -> jobs on that day.
  const byDay = useMemo(() => {
    const m = new Map<string, (JobCard & { id: string })[]>();
    jobs.forEach((j) => {
      const d = jobDate(j);
      if (!d) return;
      const k = dayKey(d);
      const arr = m.get(k) ?? [];
      arr.push(j);
      m.set(k, arr);
    });
    return m;
  }, [jobs]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dayKey(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedJobs = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarDays size={15} className="text-burgundy-500" /> Job Calendar
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelected(null); }}
            className="rounded-lg border border-line p-1.5 text-ink-soft transition hover:text-burgundy-600"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[120px] text-center text-xs font-semibold text-ink">
            {monthLabel}
          </span>
          <button
            onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelected(null); }}
            className="rounded-lg border border-line p-1.5 text-ink-soft transition hover:text-burgundy-600"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-ink-faint">
        {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = dayKey(d);
          const dayJobs = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const isSel = k === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : k)}
              className={`relative flex h-11 flex-col items-center justify-center rounded-lg text-xs transition ${
                isSel
                  ? "bg-burgundy-600 text-white"
                  : isToday
                  ? "bg-burgundy-50 text-burgundy-700"
                  : "text-ink-soft hover:bg-surface-muted"
              }`}
            >
              <span className={isToday && !isSel ? "font-bold" : ""}>{d.getDate()}</span>
              {dayJobs.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {dayJobs.slice(0, 3).map((j, n) => (
                    <span
                      key={n}
                      className="h-1 w-1 rounded-full"
                      style={{
                        background: isSel
                          ? "rgba(255,255,255,0.9)"
                          : STATUS_COLOR[JOB_STATUS_META[j.status].tone] ?? VIZ.slate,
                      }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's jobs */}
      {selected && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold text-ink">
            {new Date(selected).toLocaleDateString(undefined, {
              weekday: "long", month: "short", day: "numeric",
            })}
            {" · "}{selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}
          </p>
          {selectedJobs.length === 0 ? (
            <p className="py-2 text-xs text-ink-faint">No jobs scheduled this day.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedJobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/dashboard/job-cards/${j.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-muted"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[JOB_STATUS_META[j.status].tone] ?? VIZ.slate }}
                  />
                  <span className="flex-1 truncate text-xs font-medium text-ink">{j.complaint}</span>
                  <span className="shrink-0 text-[11px] text-ink-faint">{customerName(j.customerId)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
