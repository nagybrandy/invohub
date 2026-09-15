// lib/invoices/pdf-layout.ts
// Layout helpers for readable invoice PDFs (no overlapping text).
import type PDFDocument from "pdfkit";

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
  doc.save();
  doc.roundedRect(x, y, size, size, 8).fill(accent);
  doc.fillColor("#ffffff")
    .font("Helvetica-Bold")
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
  doc.fontSize(fontSize).fillColor(options?.color ?? "#111111");
  doc.font(options?.bold ? "Helvetica-Bold" : "Helvetica");

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
  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(accent);
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
  doc.font("Helvetica").fontSize(fontSize);

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

export function drawTotalLine(
  doc: Doc,
  label: string,
  value: string,
  xLabel: number,
  xValue: number,
  y: number,
  options?: { bold?: boolean; accent?: string; fontSize?: number }
): number {
  const fontSize = options?.fontSize ?? 10;
  doc.fontSize(fontSize);
  doc.font(options?.bold ? "Helvetica-Bold" : "Helvetica");
  doc.fillColor(options?.accent ?? "#111111");
  doc.text(label, xLabel, y, { width: 80, align: "right" });
  doc.text(value, xValue, y, { width: 72, align: "right" });
  doc.fillColor("#000000");
  return y + fontSize + 6;
}

export function contentBottom(doc: Doc, reserveFooter = 36): number {
  return doc.page.height - doc.page.margins.bottom - reserveFooter;
}

export function ensureSpace(doc: Doc, neededHeight: number, reserveFooter = 36): void {
  if (doc.y + neededHeight > contentBottom(doc, reserveFooter)) {
    doc.addPage();
  }
}
