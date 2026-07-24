/** Money + date formatting helpers. Money is stored in minor units (cents). */

export function formatMoney(minor: number, currency = "LKR"): string {
  const major = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Parse a user-typed major-unit amount ("1,250.50") into minor units. */
export function toMinor(input: string | number): number {
  const n =
    typeof input === "number"
      ? input
      : parseFloat(String(input).replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function formatDate(ts?: { toDate: () => Date } | Date | null): string {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : ts.toDate();
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(
  ts?: { toDate: () => Date } | Date | null
): string {
  if (!ts) return "—";
  const d = ts instanceof Date ? ts : ts.toDate();
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(
  ts?: { toDate: () => Date } | Date | null,
  now = new Date(),
): string {
  if (!ts) return "Just now";
  const date = ts instanceof Date ? ts : ts.toDate();
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)}d ago`;
  return formatDateTime(date);
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
