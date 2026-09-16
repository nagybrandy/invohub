// lib/invoices/pdf-layout.ts
// Layout helpers for readable invoice PDFs (no overlapping text).
import type PDFDocument from "pdfkit";
import { documentFontNames } from "@/lib/invoices/pdf-fonts";

type Doc = InstanceType<typeof PDFDocument>;

export function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function drawLogoBadge(
  doc: Doc,
  x: number,
  y: number,
  size: number,
  initials: string,
  accent: string
): void {
  const { bold } = documentFontNames(doc);
  doc.save();
  doc.roundedRect(x, y, size, size, 8).fill(accent);
  doc.fillColor("#ffffff")
    .font(bold)
    .fontSize(Math.round(size * 0.38))
    .text(initials, x, y + size * 0.28, { width: size, align: "center" });
  doc.restore();
  doc.fillColor("#000000");
}

export async function loadLogoImage(logoUrl?: string): Promise<Buffer | null> {
  if (!logoUrl?.trim()) return null;

  if (logoUrl.startsWith("data:")) {
    const base64 = logoUrl.split(",")[1];
    if (!base64) return null;
    return Buffer.from(base64, "base64");
  }

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export function drawLogoImage(
  doc: Doc,
  buffer: Buffer,
  x: number,
  y: number,
  size: number
): void {
  try {
    doc.image(buffer, x, y, { fit: [size, size], align: "center", valign: "center" });
  } catch {
    // Unsupported image format — caller may fall back to initials badge.
  }
}

export function textBlockHeight(
  doc: Doc,
  lines: string[],
  width: number,
  fontSize: number,
  lineGap = 2
): number {
  doc.fontSize(fontSize);
  let height = 0;
  for (const line of lines) {
    if (!line) continue;
    height += doc.heightOfString(line, { width }) + lineGap;
  }
  return Math.max(height, doc.currentLineHeight());
}

export function drawTextBlock(
  doc: Doc,
  lines: string[],
  x: number,
  y: number,
  width: number,
  fontSize: number,
  options?: { bold?: boolean; color?: string; lineGap?: number }
): number {
  const lineGap = options?.lineGap ?? 3;
  const { regular, bold } = documentFontNames(doc);
  doc.fontSize(fontSize).fillColor(options?.color ?? "#111111");
  doc.font(options?.bold ? bold : regular);

  let cursorY = y;
  for (const line of lines) {
    if (!line) continue;
    doc.text(line, x, cursorY, { width });
    cursorY += doc.heightOfString(line, { width }) + lineGap;
  }
  doc.fillColor("#000000");
  return cursorY;
}

export type TableColumns = {
  left: number;
  right: number;
  descWidth: number;
  qtyX: number;
  unitX: number;
  vatX: number;
  totalX: number;
  qtyWidth: number;
  unitWidth: number;
  vatWidth: number;
  totalWidth: number;
};

export function tableColumns(doc: Doc): TableColumns {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const right = left + pageWidth;

  // Column widths/gaps are computed right-to-left so the description column
  // absorbs whatever space remains — this keeps the fixed-width columns from
  // ever overlapping regardless of page width. qtyWidth is wide enough for
  // the Hungarian header "Mennyiség" (the longest column label) to stay on
  // one line at the table's bold header font size.
  const gap = 8;
  const totalWidth = 72;
  const vatWidth = 34;
  const unitWidth = 58;
  const qtyWidth = 60;

  const totalX = right - totalWidth;
  const vatX = totalX - gap - vatWidth;
  const unitX = vatX - gap - unitWidth;
  const qtyX = unitX - gap - qtyWidth;
  const descWidth = qtyX - left - gap;

  return {
    left,
    right,
    descWidth,
    qtyX,
    unitX,
    vatX,
    totalX,
    qtyWidth,
    unitWidth,
    vatWidth,
    totalWidth,
  };
}

export function drawTableHeader(
  doc: Doc,
  cols: TableColumns,
  labels: string[],
  fontSize: number,
  accent: string
): number {
  const y = doc.y;
  const { bold } = documentFontNames(doc);
  doc.font(bold).fontSize(fontSize).fillColor(accent);
  const cells: Array<{ text: string; x: number; width: number; align?: "left" | "right" }> = [
    { text: labels[0] ?? "Description", x: cols.left, width: cols.descWidth },
    { text: labels[1] ?? "Qty", x: cols.qtyX, width: cols.qtyWidth, align: "right" },
    { text: labels[2] ?? "Unit", x: cols.unitX, width: cols.unitWidth, align: "right" },
    { text: labels[3] ?? "VAT", x: cols.vatX, width: cols.vatWidth, align: "right" },
    { text: labels[4] ?? "Total", x: cols.totalX, width: cols.totalWidth, align: "right" },
  ];
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y, { width: cell.width, align: cell.align });
  }
  doc.fillColor("#000000");

  // A header label can wrap onto two lines (e.g. a narrow column width or a
  // longer translation), so measure the actual rendered height of every
  // cell instead of assuming a single line.
  const headerHeight = Math.max(
    doc.currentLineHeight(),
    ...cells.map((cell) => doc.heightOfString(cell.text, { width: cell.width }))
  );
  const headerBottom = y + headerHeight + 6;
  doc.moveTo(cols.left, headerBottom).lineTo(cols.right, headerBottom).strokeColor(accent).lineWidth(1).stroke();
  doc.lineWidth(1);
  return headerBottom + 8;
}

export type TableRow = {
  description: string;
  quantity: string;
  unitPrice: string;
  vat: string;
  total: string;
};

export function drawTableRow(
  doc: Doc,
  cols: TableColumns,
  row: TableRow,
  y: number,
  fontSize: number
): number {
  const { regular } = documentFontNames(doc);
  doc.font(regular).fontSize(fontSize);

  const descHeight = doc.heightOfString(row.description, { width: cols.descWidth });
  const singleLine = doc.currentLineHeight();
  const rowHeight = Math.max(descHeight, singleLine) + 6;

  doc.text(row.description, cols.left, y, { width: cols.descWidth, lineGap: 2 });
  doc.text(row.quantity, cols.qtyX, y, { width: cols.qtyWidth, align: "right" });
  doc.text(row.unitPrice, cols.unitX, y, { width: cols.unitWidth, align: "right" });
  doc.text(row.vat, cols.vatX, y, { width: cols.vatWidth, align: "right" });
  doc.text(row.total, cols.totalX, y, { width: cols.totalWidth, align: "right" });

  return y + rowHeight;
}

/**
 * Measured totals label/value columns, aligned with the totals rule that
 * starts at `left + pageWidth * 0.52` and ending flush with the table's
 * Bruttó (gross) column. `labelWidth` is wide enough that every Hungarian
 * totals label ("Fizetendő összesen:") fits on one line at every fontScale
 * (AC5/AC6) — the fixed 80pt column that used to overflow is gone.
 */
export type TotalsColumns = {
  labelX: number;
  labelWidth: number;
  valueX: number;
  valueWidth: number;
};

export function totalsColumns(doc: Doc, cols: TableColumns): TotalsColumns {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelX = doc.page.margins.left + pageWidth * 0.52;
  const valueX = cols.totalX;
  const valueWidth = cols.totalWidth;
  const labelWidth = valueX - 8 - labelX;
  return { labelX, labelWidth, valueX, valueWidth };
}

export function drawTotalLine(
  doc: Doc,
  label: string,
  value: string,
  xLabel: number,
  xValue: number,
  y: number,
  labelWidth: number,
  valueWidth: number,
  options?: { bold?: boolean; accent?: string; fontSize?: number }
): number {
  const fontSize = options?.fontSize ?? 10;
  const { regular, bold } = documentFontNames(doc);
  doc.fontSize(fontSize);
  doc.font(options?.bold ? bold : regular);
  doc.fillColor(options?.accent ?? "#111111");
  doc.text(label, xLabel, y, { width: labelWidth, align: "right" });
  doc.text(value, xValue, y, { width: valueWidth, align: "right" });
  doc.fillColor("#000000");
  // Measured advance (AC7): the old `y + fontSize + 6` assumed a single
  // line and silently overlapped whatever was drawn next whenever the
  // label wrapped (e.g. "Fizetendő összesen:" in an 80pt column at the
  // subtitle size). Measuring the actually-rendered height of both the
  // label and the value fixes that for any font size / column width.
  const measuredHeight = Math.max(
    doc.heightOfString(label, { width: labelWidth }),
    doc.heightOfString(value, { width: valueWidth })
  );
  return y + measuredHeight + 6;
}

// The real page margin every side of the document uses, independent of the
// reserved footer band (AC1/AC2).
export const PAGE_MARGIN = 48;

// Height of the footer band reserved at the bottom of every page — the
// InvoHub attribution/mark lockup plus the issuer's own footerText are
// drawn inside this band, never above doc.page.height - margins.bottom
// (AC8) and never inside the content area content already avoids (AC9).
export const FOOTER_BAND_HEIGHT = 36;

/**
 * Bottom margin the invoice document is CREATED with: the real page margin
 * plus the reserved footer band. pdfkit's own auto-pagination inside
 * doc.text() breaks at page.height - page.margins.bottom, so folding the
 * footer band into the document's own bottom margin is what stops wrapped
 * content from flowing into the footer strip (AC1/AC2) — the two
 * mechanisms that used to disagree about where a page ends now can't,
 * because they read the same number by construction.
 */
export const CONTENT_MARGIN_BOTTOM = PAGE_MARGIN + FOOTER_BAND_HEIGHT; // 84

export const PDF_PAGE_MARGINS = {
  top: PAGE_MARGIN,
  left: PAGE_MARGIN,
  right: PAGE_MARGIN,
  bottom: CONTENT_MARGIN_BOTTOM,
};

/**
 * Bottom of the usable content area. Computed from the fixed geometry
 * constants, NEVER from the live `doc.page.margins.bottom` — the footer
 * draw pass temporarily zeroes that margin (pdfkit's own buffered-pages
 * idiom) while this function must keep returning the same value regardless
 * (AC1).
 */
export function contentBottom(doc: Doc): number {
  return doc.page.height - CONTENT_MARGIN_BOTTOM;
}

/**
 * Top edge of the footer band — the y where content must stop and the
 * footer strip begins. Deliberately identical to contentBottom(doc) (AC1):
 * the band the footer occupies is exactly the band content already avoids,
 * so they cannot collide by construction.
 */
export function footerBandTop(doc: Doc): number {
  return contentBottom(doc);
}

/**
 * Advances to a new page only when the current position is already past
 * the top margin AND the next block would cross contentBottom (AC4). The
 * `doc.y <= margins.top + 0.5` guard (AC3) is the "blank page" fix: without
 * it, a single block taller than a whole content area (e.g. the old fixed
 * `ensureSpace(doc, 90)` before totals, or a big notes reserve) could open
 * a fresh page, still not fit, and open another — wasting a page that
 * never received a single mark.
 */
export function ensureSpace(doc: Doc, neededHeight: number): void {
  if (doc.y <= doc.page.margins.top + 0.5) return;
  if (doc.y + neededHeight > contentBottom(doc)) {
    doc.addPage();
  }
}
