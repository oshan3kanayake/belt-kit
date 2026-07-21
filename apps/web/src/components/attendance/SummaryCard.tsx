"use client";

type SummaryCardProps = {
  label: string;
  value: string | number;
  tone?: "burgundy" | "green" | "amber" | "blue";
};

export function SummaryCard({ label, value, tone = "burgundy" }: SummaryCardProps) {
  const colorClass = {
    burgundy: "bg-burgundy-50 text-burgundy-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${colorClass}`}>{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</div>
    </div>
  );
}
