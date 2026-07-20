/** Lightweight browser-side PDF export for business report tables. */

import { jsPDF } from "jspdf";
import type { CsvCell, CsvColumn } from "./csv-export";

function cellText(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function safePdfText(value: CsvCell): string {
  // PDF text must not contain control characters supplied by a customer, part,
  // or other report record. Keep normal spaces, punctuation, and line breaks.
  return cellText(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
}

export interface PdfReportOptions<Row> {
  filename: string;
  title: string;
  periodLabel: string;
  columns: CsvColumn<Row>[];
  rows: Row[];
}

/** Download a simple, printable A4 PDF containing every row in a report. */
export function downloadReportPdf<Row>({
  filename,
  title,
  periodLabel,
  columns,
  rows,
}: PdfReportOptions<Row>): void {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const columnWidth = contentWidth / Math.max(columns.length, 1);
  const lineHeight = 10;
  const cellPadding = 4;
  let y = margin;

  const drawHeader = (includeTitle: boolean) => {
    if (includeTitle) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(`BELT-KIT — ${title}`, margin, y);
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Period: ${periodLabel}`, margin, y);
      y += 13;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 16;
    }

    pdf.setDrawColor(185, 185, 185);
    pdf.setFillColor(242, 242, 242);
    pdf.rect(margin, y, contentWidth, 17, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    columns.forEach((column, index) => {
      const x = margin + index * columnWidth + cellPadding;
      const heading = pdf.splitTextToSize(column.header, columnWidth - cellPadding * 2);
      pdf.text(heading.slice(0, 2), x, y + 10);
    });
    pdf.setFont("helvetica", "normal");
    y += 17;
  };

  drawHeader(true);

  if (!rows.length) {
    pdf.setFontSize(10);
    pdf.text("No records were found for this report.", margin, y + 14);
  } else {
    rows.forEach((row) => {
      pdf.setFontSize(7.5);
      const cells = columns.map((column) =>
        pdf.splitTextToSize(safePdfText(column.value(row)), columnWidth - cellPadding * 2)
      );
      const rowHeight = Math.max(
        17,
        ...cells.map((lines) => lines.length * lineHeight + cellPadding * 2)
      );

      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawHeader(false);
      }

      pdf.setDrawColor(215, 215, 215);
      pdf.rect(margin, y, contentWidth, rowHeight, "S");
      cells.forEach((lines, index) => {
        const x = margin + index * columnWidth + cellPadding;
        pdf.text(lines, x, y + lineHeight + cellPadding - 1);
        if (index > 0) {
          pdf.line(margin + index * columnWidth, y, margin + index * columnWidth, y + rowHeight);
        }
      });
      y += rowHeight;
    });
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
