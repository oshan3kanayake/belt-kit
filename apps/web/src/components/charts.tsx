"use client";

/**
 * Reusable, theme-matched chart components built on Recharts.
 * Cool-SaaS palette: indigo primary, teal accent, slate neutrals.
 * All are presentation-only — parents pass already-shaped data.
 */

import { ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const VIZ = {
  indigo: "#2563EB",
  teal: "#0891B2",
  violet: "#7C3AED",
  sky: "#38BDF8",
  amber: "#F59E0B",
  rose: "#E11D48",
  emerald: "#059669",
  slate: "#64748B",
};

const AXIS = { fontSize: 11, fill: "#9CA3AF" };

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string | number;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-luxe">
      {label !== undefined && (
        <p className="mb-1 font-semibold text-ink">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-ink-soft">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}:{" "}
          <span className="font-semibold text-ink">
            {formatter ? formatter(p.value ?? 0) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Smooth area trend (revenue, activity over time). */
export function AreaTrend({
  data,
  dataKey = "value",
  xKey = "label",
  color = VIZ.indigo,
  height = 220,
  formatter,
}: {
  data: Record<string, number | string>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
  formatter?: (v: number) => string;
}) {
  const id = `grad-${dataKey}-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => (formatter ? formatter(v) : String(v))}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Donut for categorical breakdown (job status). */
export function StatusDonut({
  data,
  height = 200,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink">{total}</span>
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">
          Total
        </span>
      </div>
    </div>
  );
}

/** Vertical bars (inventory levels, counts). */
export function MiniBar({
  data,
  dataKey = "value",
  xKey = "label",
  color = VIZ.teal,
  height = 220,
  formatter,
}: {
  data: Record<string, number | string>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
  formatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          cursor={{ fill: "#EEF1F5" }}
          content={<ChartTooltip formatter={formatter} />}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline sparkline for KPI cards (no axes). */
export function Sparkline({
  data,
  color = VIZ.indigo,
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const shaped = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={shaped} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** KPI card with label, value, delta, and optional sparkline. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  spark,
  sparkColor = VIZ.indigo,
  accent = VIZ.indigo,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  spark?: number[];
  sparkColor?: string;
  accent?: string;
}) {
  return (
    <div className="card group relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
            {value}
          </p>
          {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: `${accent}14`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3 -mb-1">
          <Sparkline data={spark} color={sparkColor} />
        </div>
      )}
    </div>
  );
}
