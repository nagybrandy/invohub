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

/** Measured widest cell per numeric column (see tableColumns). */
export type TableContentWidths = Partial<{
  quantity: number;
  unitPrice: number;
  net: number;
  vat: number;
  total: number;
}>;

const MIN_DESCRIPTION_WIDTH = 150;

export function tableColumns(doc: Doc, content: TableContentWidths = {}): TableColumns {
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
  //
  // `content` carries the measured widest value per column: a column grows
  // to fit it (never shrinks below its default) so a large amount such as
  // "1 250 000,00 €" stays on one line; the growth is capped so the
  // description column keeps at least MIN_DESCRIPTION_WIDTH.
  const gap = 8;
  const defaults = { total: 72, vat: 34, net: 62, unitPrice: 58, quantity: 60 };
  const extra = (key: keyof typeof defaults) =>
    Math.max(0, Math.ceil((content[key] ?? 0) + 1) - defaults[key]);
  const extras = {
    total: extra("total"),
    vat: extra("vat"),
    net: extra("net"),
    unitPrice: extra("unitPrice"),
    quantity: extra("quantity"),
  };
  const fixed = Object.values(defaults).reduce((a, b) => a + b, 0) + gap * 5;
  const room = Math.max(0, pageWidth - fixed - MIN_DESCRIPTION_WIDTH);
  const wanted = Object.values(extras).reduce((a, b) => a + b, 0);
  const scale = wanted > room ? room / wanted : 1;

  const totalWidth = defaults.total + extras.total * scale;
  const vatWidth = defaults.vat + extras.vat * scale;
  const netWidth = defaults.net + extras.net * scale;
  const unitWidth = defaults.unitPrice + extras.unitPrice * scale;
  const qtyWidth = defaults.quantity + extras.quantity * scale;

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

// Document rule colours: a strong heading-ink rule under the table header,
// quiet hairlines everywhere else (see generate-pdf.ts's layout notes).
export const DOCUMENT_HAIRLINE = "#e3e7ef";
export const DOCUMENT_RULE = "#111f4a";
const TABLE_LABEL_COLOR = "#5b6178";

/** Smallest caption/label size the document uses, derived from the template's scale. */
export function documentLabelSize(smallFontSize: number): number {
  return Math.max(6.5, smallFontSize - 1.5);
}

/**
 * Draws the line-item column header — uppercase, letter-spaced, muted labels
 * over a single heading-ink rule, no filled band — and returns the y where
 * the first row starts. Measures every cell so a wrapped label (a narrow
 * column or a longer translation) grows the header instead of overlapping.
 */
export function drawTableHeader(
  doc: Doc,
  cols: TableColumns,
  labels: string[],
  fontSize: number
): number {
  const y = doc.y;
  const { bold } = documentFontNames(doc);
  const labelSize = documentLabelSize(fontSize);
  doc.font(bold).fontSize(labelSize);
  type HeaderCell = { text: string; x: number; width: number; align?: "left" | "right" };
  const rawCells: HeaderCell[] = [
    { text: labels[0] ?? "Description", x: cols.left, width: cols.descWidth },
    { text: labels[1] ?? "Qty", x: cols.qtyX, width: cols.qtyWidth, align: "right" },
    { text: labels[2] ?? "Unit", x: cols.unitX, width: cols.unitWidth, align: "right" },
    { text: labels[3] ?? "Net", x: cols.netX, width: cols.netWidth, align: "right" },
    { text: labels[4] ?? "VAT", x: cols.vatX, width: cols.vatWidth, align: "right" },
    { text: labels[5] ?? "Total", x: cols.totalX, width: cols.totalWidth, align: "right" },
  ];
  const cells = rawCells.map((cell) => ({ ...cell, text: cell.text.toUpperCase() }));

  const labelHeight = Math.max(
    doc.currentLineHeight(),
    ...cells.map((cell) => doc.heightOfString(cell.text, { width: cell.width }))
  );

  doc.fillColor(TABLE_LABEL_COLOR);
  for (const cell of cells) {
    doc.text(cell.text, cell.x, y, { width: cell.width, align: cell.align, characterSpacing: 0.4 });
  }
  doc.fillColor("#000000");

  const ruleY = y + labelHeight + 6;
  doc.moveTo(cols.left, ruleY).lineTo(cols.right, ruleY).strokeColor(DOCUMENT_RULE).lineWidth(0.8).stroke();
  doc.strokeColor("#000000").lineWidth(1);

  return ruleY + 8;
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

  const descHeight = doc.heightOfString(row.description, { width: cols.descWidth, lineGap: 2 });
  const singleLine = doc.currentLineHeight();
  // Every cell is measured, not just the description: a numeric value that
  // still wraps (a squeezed column) grows the row instead of running into
  // the next one.
  const cellHeights = [
    doc.heightOfString(row.quantity, { width: cols.qtyWidth }),
    doc.heightOfString(row.unitPrice, { width: cols.unitWidth }),
    doc.heightOfString(row.net, { width: cols.netWidth }),
    doc.heightOfString(row.vat, { width: cols.vatWidth }),
    doc.heightOfString(row.total, { width: cols.totalWidth }),
  ];
  const rowHeight = Math.max(descHeight, singleLine, ...cellHeights) + 9;

  doc.fillColor("#14162b");
  doc.text(row.description, cols.left, y, { width: cols.descWidth, lineGap: 2 });
  doc.fillColor("#4a4f6a");
  doc.text(row.quantity, cols.qtyX, y, { width: cols.qtyWidth, align: "right" });
  doc.text(row.unitPrice, cols.unitX, y, { width: cols.unitWidth, align: "right" });
  doc.text(row.net, cols.netX, y, { width: cols.netWidth, align: "right" });
  doc.text(row.vat, cols.vatX, y, { width: cols.vatWidth, align: "right" });
  doc.fillColor("#14162b");
  doc.text(row.total, cols.totalX, y, { width: cols.totalWidth, align: "right" });
  doc.fillColor("#000000");

  const bottomY = y + rowHeight;
  doc.moveTo(cols.left, bottomY - 4).lineTo(cols.right, bottomY - 4).strokeColor(DOCUMENT_HAIRLINE).lineWidth(0.6).stroke();
  doc.strokeColor("#000000").lineWidth(1);

  return bottomY + 3;
}

// ---------------------------------------------------------------------------
// Party blocks — Kibocsátó / Vevő. No filled card: a short accent tick, an
// uppercase caption, the party name in heading ink, then detail lines.
// ---------------------------------------------------------------------------

export type PartyBlockOptions = {
  width: number;
  title: string;
  name: string;
  lines: string[];
  fontSizes: { label: number; name: number; body: number };
};

const PARTY_TICK_HEIGHT = 2;
const PARTY_TICK_WIDTH = 18;

/** Measures a party block WITHOUT drawing it, so two blocks can share one ensureSpace reservation. */
export function partyBlockHeight(doc: Doc, opts: PartyBlockOptions): number {
  const { bold, regular } = documentFontNames(doc);
  doc.font(bold).fontSize(opts.fontSizes.label);
  let height = PARTY_TICK_HEIGHT + 7 + doc.heightOfString(opts.title.toUpperCase(), { width: opts.width }) + 5;
  doc.font(bold).fontSize(opts.fontSizes.name);
  height += doc.heightOfString(opts.name, { width: opts.width }) + 3;
  doc.font(regular).fontSize(opts.fontSizes.body);
  for (const line of opts.lines) {
    if (!line) continue;
    height += doc.heightOfString(line, { width: opts.width }) + 2;
  }
  return height;
}

/** Draws a party block at (x, y) and returns its bottom y. */
export function drawPartyBlock(
  doc: Doc,
  opts: PartyBlockOptions & { x: number; y: number; accent: string }
): number {
  const { bold, regular } = documentFontNames(doc);
  let cursorY = opts.y;

  doc.rect(opts.x, cursorY, PARTY_TICK_WIDTH, PARTY_TICK_HEIGHT).fill(normalizeHexColor(opts.accent));
  cursorY += PARTY_TICK_HEIGHT + 7;

  const title = opts.title.toUpperCase();
  doc.font(bold).fontSize(opts.fontSizes.label).fillColor(TABLE_LABEL_COLOR);
  doc.text(title, opts.x, cursorY, { width: opts.width, characterSpacing: 0.6 });
  cursorY += doc.heightOfString(title, { width: opts.width }) + 5;

  doc.font(bold).fontSize(opts.fontSizes.name).fillColor("#111f4a");
  doc.text(opts.name, opts.x, cursorY, { width: opts.width });
  cursorY += doc.heightOfString(opts.name, { width: opts.width }) + 3;

  doc.font(regular).fontSize(opts.fontSizes.body).fillColor("#4a4f6a");
  for (const line of opts.lines) {
    if (!line) continue;
    doc.text(line, opts.x, cursorY, { width: opts.width });
    cursorY += doc.heightOfString(line, { width: opts.width }) + 2;
  }
  doc.fillColor("#000000");
  return cursorY;
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
