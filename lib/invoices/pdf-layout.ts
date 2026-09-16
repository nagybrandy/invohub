// lib/invoices/pdf-layout.ts
// Layout helpers for readable invoice PDFs (no overlapping text).
import type PDFDocument from "pdfkit";
import { documentFontNames } from "@/lib/invoices/pdf-fonts";
import { normalizeHexColor } from "@/lib/invoices/pdf-template/defaults";

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

// ---------------------------------------------------------------------------
// Brand-colour helpers (AC1/AC2)
// ---------------------------------------------------------------------------

function clamp01(ratio: number): number {
  if (Number.isNaN(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Mixes `hex` toward white by `ratio` (clamped to [0, 1]). Malformed input
 * falls back to the default accent, same as `normalizeHexColor` (AC1).
 * `tint(c, 0)` is the normalised `c` unchanged; `tint(c, 1)` is `#ffffff`.
 */
export function tint(hex: string, ratio: number): string {
  const normalized = normalizeHexColor(hex);
  const r = clamp01(ratio);
  const [red, green, blue] = hexToRgb(normalized);
  return rgbToHex(red + (255 - red) * r, green + (255 - green) * r, blue + (255 - blue) * r);
}

// Perceived-brightness threshold (0-255 scale, ITU-R BT.601 weights) below
// which white text reads better than the document's navy ink on a fill of
// this colour — chosen so the default accent (#6495ed, luminance ≈144) and
// the navy itself (#111f4a, luminance ≈32) both get white text, while any
// lighter tint of the accent (e.g. tint(accent, 0.24), luminance ≈171) and
// pale user colours get the navy text (AC2).
const READABLE_TEXT_LUMINANCE_THRESHOLD = 150;

/** Returns `#ffffff` on a dark fill, `#111f4a` (document navy) on a light one (AC2). */
export function readableTextOn(hex: string): string {
  const normalized = normalizeHexColor(hex);
  const [r, g, b] = hexToRgb(normalized);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < READABLE_TEXT_LUMINANCE_THRESHOLD ? "#ffffff" : "#111f4a";
}

export type TableColumns = {
  left: number;
  right: number;
  descWidth: number;
  qtyX: number;
  unitX: number;
  netX: number;
  vatX: number;
  totalX: number;
  qtyWidth: number;
  unitWidth: number;
  netWidth: number;
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
  // one line at the table's bold header font size. netWidth mirrors
  // unitWidth — "Nettó" is a short label but the column holds a formatted
  // money amount, same as Egységár/Bruttó (AC3).
  const gap = 8;
  const totalWidth = 72;
  const vatWidth = 34;
  const netWidth = 62;
  const unitWidth = 58;
  const qtyWidth = 60;

  const totalX = right - totalWidth;
  const vatX = totalX - gap - vatWidth;
  const netX = vatX - gap - netWidth;
  const unitX = netX - gap - unitWidth;
  const qtyX = unitX - gap - qtyWidth;
  const descWidth = qtyX - left - gap;

  return {
    left,
    right,
    descWidth,
    qtyX,
    unitX,
    netX,
    vatX,
    totalX,
    qtyWidth,
    unitWidth,
    netWidth,
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
  const textColor = readableTextOn(accent);
  doc.font(bold).fontSize(fontSize);
  const cells: Array<{ text: string; x: number; width: number; align?: "left" | "right" }> = [
    { text: labels[0] ?? "Description", x: cols.left, width: cols.descWidth },
    { text: labels[1] ?? "Qty", x: cols.qtyX, width: cols.qtyWidth, align: "right" },
    { text: labels[2] ?? "Unit", x: cols.unitX, width: cols.unitWidth, align: "right" },
    { text: labels[3] ?? "Net", x: cols.netX, width: cols.netWidth, align: "right" },
    { text: labels[4] ?? "VAT", x: cols.vatX, width: cols.vatWidth, align: "right" },
    { text: labels[5] ?? "Total", x: cols.totalX, width: cols.totalWidth, align: "right" },
  ];

  // A header label can wrap onto two lines (e.g. a narrow column width or a
  // longer translation), so measure the actual rendered height of every
  // cell instead of assuming a single line — the filled band (AC4) grows
  // with it.
  const padY = 6;
  const headerHeight = Math.max(
    doc.currentLineHeight(),
    ...cells.map((cell) => doc.heightOfString(cell.text, { width: cell.width }))
  );
  const bandHeight = headerHeight + padY * 2;

  doc.rect(cols.left, y, cols.right - cols.left, bandHeight).fill(accent);

  doc.fillColor(textColor);
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y + padY, { width: cell.width, align: cell.align });
  }
  doc.fillColor("#000000");

  return y + bandHeight + 8;
}

export type TableRow = {
  description: string;
  quantity: string;
  unitPrice: string;
  net: string;
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

  doc.fillColor("#111111");
  doc.text(row.description, cols.left, y, { width: cols.descWidth, lineGap: 2 });
  doc.text(row.quantity, cols.qtyX, y, { width: cols.qtyWidth, align: "right" });
  doc.text(row.unitPrice, cols.unitX, y, { width: cols.unitWidth, align: "right" });
  doc.text(row.net, cols.netX, y, { width: cols.netWidth, align: "right" });
  doc.text(row.vat, cols.vatX, y, { width: cols.vatWidth, align: "right" });
  doc.text(row.total, cols.totalX, y, { width: cols.totalWidth, align: "right" });
  doc.fillColor("#000000");

  const bottomY = y + rowHeight;
  // Per-row hairline (AC5) — the preview's `td { border-bottom: 1px solid
  // #e5e9f5; }` equivalent, spanning the full table width.
  doc.moveTo(cols.left, bottomY).lineTo(cols.right, bottomY).strokeColor("#e5e9f5").lineWidth(1).stroke();
  doc.strokeColor("#000000");

  return bottomY;
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

// ---------------------------------------------------------------------------
// Party cards (AC6) — mirrors preview-html.ts's `.party-card`.
// ---------------------------------------------------------------------------

const PARTY_CARD_PADDING = 10;
const PARTY_CARD_RADIUS = 10;

export type PartyCardMeasureOptions = {
  width: number;
  title: string;
  lines: string[];
  fontSizes: { title: number; body: number };
};

export type PartyCardOptions = PartyCardMeasureOptions & {
  x: number;
  y: number;
  accent: string;
  /** Force the card to this height (e.g. the max of two cards) instead of its own measured height. */
  height?: number;
};

/** Measures a party card's height WITHOUT drawing it (AC6), so two cards can be reserved and drawn at equal height. */
export function partyCardHeight(doc: Doc, opts: PartyCardMeasureOptions): number {
  const { bold, regular } = documentFontNames(doc);
  const innerWidth = opts.width - PARTY_CARD_PADDING * 2;
  const title = opts.title.toUpperCase();

  doc.font(bold).fontSize(opts.fontSizes.title);
  const titleHeight = doc.heightOfString(title, { width: innerWidth });

  doc.font(regular).fontSize(opts.fontSizes.body);
  let linesHeight = 0;
  for (const line of opts.lines) {
    if (!line) continue;
    linesHeight += doc.heightOfString(line, { width: innerWidth }) + 2;
  }

  return titleHeight + 6 + linesHeight + PARTY_CARD_PADDING * 2;
}

/**
 * Draws a rounded, `tint(accent, 0.12)`-filled card with an uppercase title
 * and body lines inside a 10pt padding box, and returns the card's bottom y
 * (AC6). Pass `height` to force a shared height across two side-by-side
 * cards (AC9); omit it to use the card's own measured height.
 */
export function drawPartyCard(doc: Doc, opts: PartyCardOptions): number {
  const height = opts.height ?? partyCardHeight(doc, opts);
  const fill = tint(opts.accent, 0.12);

  doc.roundedRect(opts.x, opts.y, opts.width, height, PARTY_CARD_RADIUS).fill(fill);

  const innerX = opts.x + PARTY_CARD_PADDING;
  const innerWidth = opts.width - PARTY_CARD_PADDING * 2;
  let cursorY = opts.y + PARTY_CARD_PADDING;

  const { bold, regular } = documentFontNames(doc);
  const title = opts.title.toUpperCase();
  doc.font(bold).fontSize(opts.fontSizes.title).fillColor("#111f4a");
  doc.text(title, innerX, cursorY, { width: innerWidth });
  cursorY += doc.heightOfString(title, { width: innerWidth }) + 6;

  doc.font(regular).fontSize(opts.fontSizes.body).fillColor("#111111");
  for (const line of opts.lines) {
    if (!line) continue;
    doc.text(line, innerX, cursorY, { width: innerWidth });
    cursorY += doc.heightOfString(line, { width: innerWidth }) + 2;
  }
  doc.fillColor("#000000");

  return opts.y + height;
}

// ---------------------------------------------------------------------------
// Note box (AC7) — mirrors preview-html.ts's `.vat-note`.
// ---------------------------------------------------------------------------

const NOTE_BOX_PADDING = 12;
const NOTE_BOX_RADIUS = 10;
const NOTE_BOX_LINE_GAP = 4;

export type NoteBoxOptions = {
  x: number;
  y: number;
  width: number;
  lines: string[];
  fill: string;
  fontSize: number;
  /** Defaults to readableTextOn(fill). */
  textColor?: string;
};

/** Draws a rounded, tinted, padded box around wrapped text and returns its measured bottom y (AC7). */
export function drawNoteBox(doc: Doc, opts: NoteBoxOptions): number {
  const { regular } = documentFontNames(doc);
  const innerWidth = opts.width - NOTE_BOX_PADDING * 2;
  doc.font(regular).fontSize(opts.fontSize);

  const validLines = opts.lines.filter(Boolean);
  let linesHeight = 0;
  for (const line of validLines) {
    linesHeight += doc.heightOfString(line, { width: innerWidth }) + NOTE_BOX_LINE_GAP;
  }
  const height = Math.max(linesHeight, doc.currentLineHeight()) + NOTE_BOX_PADDING * 2;

  doc.roundedRect(opts.x, opts.y, opts.width, height, NOTE_BOX_RADIUS).fill(opts.fill);

  doc.fillColor(opts.textColor ?? readableTextOn(opts.fill));
  let cursorY = opts.y + NOTE_BOX_PADDING;
  for (const line of validLines) {
    doc.text(line, opts.x + NOTE_BOX_PADDING, cursorY, { width: innerWidth });
    cursorY += doc.heightOfString(line, { width: innerWidth }) + NOTE_BOX_LINE_GAP;
  }
  doc.fillColor("#000000");

  return opts.y + height;
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
