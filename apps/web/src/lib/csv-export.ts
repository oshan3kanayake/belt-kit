/** Small, dependency-free CSV helpers for browser downloads. */

export type CsvCell = string | number | boolean | Date | null | undefined;

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvCell;
}

const UTF8_BOM = "\uFEFF";
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function cellText(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Prevent spreadsheet applications from evaluating exported user-entered
  // text (customer names, references, descriptions) as a formula.
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(value: CsvCell): string {
  const text = cellText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build an Excel-friendly UTF-8 CSV using RFC-style escaping and CRLF rows. */
export function createCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(",")
  );
  return `${UTF8_BOM}${[header, ...body].join("\r\n")}\r\n`;
}

export function downloadCsv<Row>(
  filename: string,
  columns: CsvColumn<Row>[],
  rows: Row[]
): void {
  const blob = new Blob([createCsv(columns, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function reportCsvFilename(
  reportName: string,
  fromDate?: string,
  toDate?: string
): string {
  const report = safeFilenamePart(reportName) || "report";
  let period = "all-time";
  if (fromDate && toDate) period = `${fromDate}-to-${toDate}`;
  else if (fromDate) period = `from-${fromDate}`;
  else if (toDate) period = `through-${toDate}`;
  return `belt-kit-${report}-${period}.csv`;
}
