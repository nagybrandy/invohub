// lib/invoices/paper/render-paper.ts
// Dóri's invoice paper (2026-11 redesign) as ONE parametrised pdfkit renderer:
// Letisztult / Sávos / Keretes x InvoHub / Klasszikus / Kerek x logo mode,
// size and position. What to print comes from the pure buildDocumentContent
// (lib/invoices/document-content.ts); how it looks comes from the tokens in
// paper/tokens.ts and the colours in paper/brand-color.ts. The design is
// measured in CSS px on a 560 px wide paper; every size below is in design px
// and converted with PX (pt per px). Plan: docs/design/invoice-paper-2026-11/PLAN.md.
//
// The legacy renderer (lib/invoices/pdf-legacy.ts) is frozen and untouched;
// this file is only reached for the layouts clean / band / frame.
import { buildDocumentContent, type DocumentContent } from "@/lib/invoices/document-content";
import { toWinAnsiSafe } from "@/lib/invoices/document-labels";
import { documentInk } from "@/lib/invoices/document-ink";
import type { InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { parseLogoDataUri, paperInitials } from "@/lib/invoices/paper/logo";
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  LOGO_MAX_WIDTH_PX,
  PAPER_INK,
  PAPER_PAGE,
  px,
  paperVariant,
  type PaperVariant,
} from "@/lib/invoices/paper/tokens";
import { createPdfDocument, withPdfKitFonts } from "@/lib/invoices/pdf-document";
import { registerPaperFonts, type PaperFontRole, type PaperFonts } from "@/lib/invoices/pdf-fonts";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import type PDFDocument from "pdfkit";

type Doc = InstanceType<typeof PDFDocument>;

// ---------------------------------------------------------------------------
// Geometry (pt)
// ---------------------------------------------------------------------------
const MARGIN = px(PAPER_PAGE.marginPx);
const LEFT = MARGIN;
const RIGHT = A4_WIDTH_PT - MARGIN;
const WIDTH = RIGHT - LEFT;
const FOOTER_TOP = A4_HEIGHT_PT - px(PAPER_PAGE.footerBandPx);
const CONTENT_BOTTOM = FOOTER_TOP - px(PAPER_PAGE.footerGapPx);
const GAP = px(PAPER_PAGE.blockGapPx);
const LINE_PX = 1;

type TextOptions = {
  role: PaperFontRole;
  /** design px */
  size: number;
  color: string;
  align?: "left" | "right" | "center";
  /** letter-spacing in em */
  spacing?: number;
  /** CSS line-height factor (default 1.4) */
  lh?: number;
  upper?: boolean;
  /** one line, no wrapping, ellipsis on overflow */
  single?: boolean;
};

type Painter = ReturnType<typeof createPainter>;

function createPainter(doc: Doc, fonts: PaperFonts) {
  const setFont = (role: PaperFontRole, size: number) => {
    doc.font(fonts[role]).fontSize(px(size));
  };

  const prepared = (text: string, o: Pick<TextOptions, "upper">) => (o.upper ? text.toUpperCase() : text);
  const spacingPt = (o: Pick<TextOptions, "spacing" | "size">) => px((o.spacing ?? 0) * o.size);

  /** Width of one line of text, pt. */
  const widthOf = (text: string, o: Pick<TextOptions, "role" | "size" | "spacing" | "upper">) => {
    setFont(o.role, o.size);
    const t = o.upper ? text.toUpperCase() : text;
    return doc.widthOfString(t, { characterSpacing: spacingPt(o) });
  };

  /** CSS-like line box height of one line, pt. */
  const lineHeight = (size: number, lh = 1.4) => px(size) * lh;

  /** Measures a paragraph: number of lines and its CSS-like height, pt. */
  const measure = (text: string, width: number, o: Omit<TextOptions, "color"> & { color?: string }) => {
    if (!text) return { lines: 0, height: 0, lineH: lineHeight(o.size, o.lh) };
    setFont(o.role, o.size);
    const base = doc.currentLineHeight();
    const lineH = lineHeight(o.size, o.lh);
    if (o.single) return { lines: 1, height: lineH, lineH };
    const natural = doc.heightOfString(prepared(text, o), { width, characterSpacing: spacingPt(o) });
    const lines = Math.max(1, Math.round(natural / base));
    return { lines, height: lines * lineH, lineH };
  };

  /** Draws a paragraph with its CSS-like line box top at y; returns its height, pt. */
  const put = (text: string, x: number, y: number, width: number, o: TextOptions): number => {
    if (!text) return 0;
    const m = measure(text, width, o);
    setFont(o.role, o.size);
    const base = doc.currentLineHeight();
    const savedBottom = doc.page.margins.bottom;
    // Every block is measured and reserved up front; pdfkit's own
    // auto-pagination must never add a page under a draw (notes excepted).
    doc.page.margins.bottom = 0;
    doc.fillColor(o.color);
    doc.text(prepared(text, o), x, y + (m.lineH - base) / 2, {
      width,
      align: o.align ?? "left",
      lineGap: Math.max(0, m.lineH - base),
      characterSpacing: spacingPt(o),
      ...(o.single ? { lineBreak: false, ellipsis: true } : {}),
    });
    doc.page.margins.bottom = savedBottom;
    return m.height;
  };

  /** y offset of the first baseline below the line box top, pt. */
  const baselineOffset = (role: PaperFontRole, size: number, lh = 1.4) => {
    setFont(role, size);
    const base = doc.currentLineHeight();
    return (lineHeight(size, lh) - base) / 2 + (doc as unknown as { _font: { ascender: number } })._font.ascender / 1000 * px(size);
  };

  return { setFont, widthOf, lineHeight, measure, put, baselineOffset };
}

type Bounds = { x: number; y: number; w: number; h: number };

function strokeRect(doc: Doc, b: Bounds, radiusPx: number, color: string, widthPx = LINE_PX) {
  const lw = px(widthPx);
  doc.save();
  doc.lineWidth(lw).strokeColor(color);
  const inset = lw / 2;
  if (radiusPx > 0) doc.roundedRect(b.x + inset, b.y + inset, b.w - lw, b.h - lw, px(radiusPx)).stroke();
  else doc.rect(b.x + inset, b.y + inset, b.w - lw, b.h - lw).stroke();
  doc.restore();
}

function fillRect(doc: Doc, b: Bounds, radiusPx: number, color: string) {
  doc.save();
  if (radiusPx > 0) doc.roundedRect(b.x, b.y, b.w, b.h, px(radiusPx)).fill(color);
  else doc.rect(b.x, b.y, b.w, b.h).fill(color);
  doc.restore();
}

function hLine(doc: Doc, x1: number, x2: number, y: number, color: string, widthPx = LINE_PX) {
  const lw = px(widthPx);
  doc.save();
  doc.moveTo(x1, y + lw / 2).lineTo(x2, y + lw / 2).lineWidth(lw).strokeColor(color).stroke();
  doc.restore();
}

function vLine(doc: Doc, x: number, y1: number, y2: number, color: string, widthPx = LINE_PX) {
  const lw = px(widthPx);
  doc.save();
  doc.moveTo(x + lw / 2, y1).lineTo(x + lw / 2, y2).lineWidth(lw).strokeColor(color).stroke();
  doc.restore();
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

type PaperInput = InvoicePdfContext & { template: InvoicePdfTemplate };

export async function renderPaperPdf(ctx: PaperInput): Promise<Buffer> {
  // The buyer's tax number is mandatory content (Áfa tv. 169. § d): the paper
  // layouts print it whenever the invoice carries one, whatever the
  // "Ügyfél adószám" toggle says.
  const content = buildDocumentContent(ctx, { alwaysPrintBuyerTaxNumber: true });
  const variant = paperVariant(content.template);
  const logoBuffer = variant.logo.mode === "own" ? parseLogoDataUri(ctx.company?.logoUrl) : null;

  return withPdfKitFonts(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        const doc = createPdfDocument({
          size: "A4",
          bufferPages: true,
          margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: A4_HEIGHT_PT - CONTENT_BOTTOM },
        });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
          const fonts = registerPaperFonts(doc, variant.fontStyle);
          if (!fonts.embedded) {
            // Helvetica last resort: WinAnsi has no ő/ű (see document-labels.ts).
            const rawText = doc.text.bind(doc) as (...args: unknown[]) => typeof doc;
            doc.text = ((value: string, ...rest: unknown[]) =>
              rawText(toWinAnsiSafe(value), ...rest)) as typeof doc.text;
          }
          drawDocument(doc, createPainter(doc, fonts), content, variant, logoBuffer);
          doc.flushPages();
          doc.end();
        } catch (error) {
          reject(error);
        }
      })
  );
}

function drawDocument(
  doc: Doc,
  p: Painter,
  c: DocumentContent,
  v: PaperVariant,
  logoBuffer: Buffer | null
): void {
  const { ink, tint, frameBorder } = v.palette;
  const T = v.tokens;
  let y = MARGIN;
  let contentStart = MARGIN;

  // ----- pagination -------------------------------------------------------
  const drawBanner = (atY: number) => {
    const h = p.put(c.continuationBanner, LEFT, atY, WIDTH, { role: "body400", size: 9.5, color: PAPER_INK.secondary });
    return atY + h + GAP;
  };
  const newPage = () => {
    doc.addPage();
    y = drawBanner(MARGIN);
    contentStart = y;
  };
  const ensure = (height: number) => {
    if (y > contentStart + 0.5 && y + height > CONTENT_BOTTOM) newPage();
  };

  // ----- header -----------------------------------------------------------
  const drawHeader = () => {
    const issuer = c.issuer;
    const leftAligned = v.logo.position === "right"; // title column on the left
    const maxCol = WIDTH * 0.5;
    const colGap = px(12);

    // Title column: [tag] TITLE / "Sorszám: n". The title steps down until it fits.
    let titleSize = 21;
    const titleWidth = (size: number) =>
      p.widthOf(c.title, { role: "head700", size, spacing: 0.01 });
    while (titleWidth(titleSize) > maxCol && titleSize > 12) titleSize -= 0.5;
    const tagText = c.statusChip ? c.statusChip.toUpperCase() : null;
    const tagW = tagText ? p.widthOf(tagText, { role: "body700", size: 8, spacing: 0.05 }) + px(12) : 0;
    const tagH = tagText ? p.lineHeight(8) + px(2) : 0;
    const inlineTag = !!tagText && tagW + px(6) + titleWidth(titleSize) <= maxCol;
    const numberText = `${c.labels.documentNumber}: ${c.number}`;
    const numberW = p.widthOf(numberText, { role: "body400", size: 9.5 });
    const titleRowW = inlineTag ? tagW + px(6) + titleWidth(titleSize) : Math.max(tagW, titleWidth(titleSize));
    const colW = Math.min(maxCol, Math.max(titleRowW, numberW) + 1);
    const titleLH = p.lineHeight(titleSize, 1.3);
    const numberLH = p.lineHeight(9.5);
    const colH = (tagText && !inlineTag ? tagH + px(3) : 0) + titleLH + numberLH;

    // Issuer: [logo] name / "address · Adószám: …"
    let logoW = 0;
    let logoH = 0;
    let imageSize: { w: number; h: number } | null = null;
    if (issuer && v.logo.mode !== "none") {
      logoH = px(v.logo.sizePx);
      logoW = logoH;
      if (v.logo.mode === "own" && logoBuffer) {
        try {
          const image = (doc as unknown as { openImage(b: Buffer): { width: number; height: number } }).openImage(logoBuffer);
          const scale = Math.min(px(LOGO_MAX_WIDTH_PX) / image.width, logoH / image.height);
          imageSize = { w: image.width * scale, h: image.height * scale };
          logoW = imageSize.w;
          logoH = imageSize.h;
        } catch {
          imageSize = null; // unreadable image: monogram
        }
      }
    }
    const logoGap = logoW > 0 ? px(10) : 0;
    const coMaxW = WIDTH - colW - colGap;
    const textMaxW = Math.max(px(100), coMaxW - logoW - logoGap);
    const nameH = issuer ? p.measure(issuer.name, textMaxW, { role: "body700", size: 12 }).height : 0;
    let subLines: string[] = [];
    if (issuer) {
      const joined = [issuer.address, issuer.taxNumber].filter(Boolean).join(" · ");
      const fits = p.widthOf(joined, { role: "body400", size: 9.5 }) <= textMaxW;
      subLines = fits ? [joined] : [issuer.address, issuer.taxNumber].filter(Boolean);
    }
    const subH = subLines.reduce((sum, line) => sum + p.measure(line, textMaxW, { role: "body400", size: 9.5 }).height, 0);
    const textH = nameH + subH;
    const textW = issuer
      ? Math.min(
          textMaxW,
          Math.max(
            p.widthOf(issuer.name, { role: "body700", size: 12 }),
            ...subLines.map((line) => p.widthOf(line, { role: "body400", size: 9.5 }))
          ) + 1
        )
      : 0;
    const coH = Math.max(logoH, textH);
    const coW = logoW + logoGap + textW;
    const headerH = Math.max(coH, colH);

    // -- draw the issuer group
    if (issuer) {
      const coX = leftAligned ? RIGHT - coW : LEFT;
      if (logoW > 0) {
        const ly = y + (coH - logoH) / 2;
        if (imageSize) {
          doc.image(logoBuffer!, coX, ly, { width: imageSize.w, height: imageSize.h });
        } else {
          fillRect(doc, { x: coX, y: ly, w: logoW, h: logoH }, 6, ink);
          const initialsSize = Math.round(v.logo.sizePx * 0.42);
          const initials = paperInitials(issuer.name);
          p.setFont("body700", initialsSize);
          const ih = doc.currentLineHeight();
          doc.fillColor(PAPER_INK.white);
          const savedBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.text(initials, coX, ly + (logoH - ih) / 2, { width: logoW, align: "center", lineBreak: false });
          doc.page.margins.bottom = savedBottom;
        }
      }
      const tx = coX + logoW + logoGap;
      let ty = y + (coH - textH) / 2;
      ty += p.put(issuer.name, tx, ty, textW + 1, { role: "body700", size: 12, color: PAPER_INK.body });
      for (const line of subLines) {
        ty += p.put(line, tx, ty, textW + 1, { role: "body400", size: 9.5, color: PAPER_INK.secondary });
      }
    }

    // -- draw the title column
    const colX = leftAligned ? LEFT : RIGHT - colW;
    const align = leftAligned ? "left" : "right";
    let cy = y;
    if (tagText && !inlineTag) {
      const tx = leftAligned ? colX : colX + colW - tagW;
      fillRect(doc, { x: tx, y: cy, w: tagW, h: tagH }, 4, PAPER_INK.tagBackground);
      p.put(tagText, tx, cy + px(1), tagW, { role: "body700", size: 8, spacing: 0.05, color: PAPER_INK.tagText, align: "center" });
      cy += tagH + px(3);
    }
    const titleW = titleWidth(titleSize);
    const titleX = leftAligned ? colX + (inlineTag ? tagW + px(6) : 0) : colX + colW - titleW - 1;
    if (tagText && inlineTag) {
      const tx = leftAligned ? colX : titleX - px(6) - tagW;
      const ty = cy + (titleLH - tagH) / 2;
      fillRect(doc, { x: tx, y: ty, w: tagW, h: tagH }, 4, PAPER_INK.tagBackground);
      p.put(tagText, tx, ty + px(1), tagW, { role: "body700", size: 8, spacing: 0.05, color: PAPER_INK.tagText, align: "center" });
    }
    p.put(c.title, titleX, cy, titleW + px(4), { role: "head700", size: titleSize, spacing: 0.01, color: ink, lh: 1.3, single: true });
    cy += titleLH;
    p.put(numberText, colX, cy, colW, { role: "body400", size: 9.5, color: PAPER_INK.secondary, align });
    y += headerH + GAP;

    // -- 2 px brand rule
    fillRect(doc, { x: LEFT, y, w: WIDTH, h: px(2) }, 0, ink);
    y += px(2) + GAP;
  };

  // ----- reference line (storno / helyesbítő, Áfa tv. 170. §) --------------
  const drawReference = () => {
    if (!c.referenceText) return;
    const h = p.measure(c.referenceText, WIDTH, { role: "body700", size: 10.5, color: PAPER_INK.body }).height;
    ensure(h);
    p.put(c.referenceText, LEFT, y, WIDTH, { role: "body700", size: 10.5, color: PAPER_INK.body });
    y += h + GAP;
  };

  // ----- meta strip ---------------------------------------------------------
  const drawMeta = () => {
    const n = c.metaCells.length;
    const padX = px(9);
    const padY = px(7);
    const captionOpts = { role: "head600", size: 7.5, spacing: 0.07, upper: true, color: PAPER_INK.caption } as const;
    const valueOpts = { role: "body700", size: 10.5, color: PAPER_INK.body } as const;
    // Dóri's strip has four cells; a fifth or sixth (Teljesítés kelte, Árfolyam)
    // stays on one row when every cell fits on one line, else two rows of three.
    const fitsOneRow =
      n <= 4 ||
      c.metaCells.every(
        (cell) =>
          Math.max(p.widthOf(cell.label, captionOpts), p.widthOf(cell.value, valueOpts)) <= WIDTH / n - padX * 2
      );
    const cols = fitsOneRow ? n : 3;
    const rows: typeof c.metaCells[] = [];
    for (let i = 0; i < n; i += cols) rows.push(c.metaCells.slice(i, i + cols));
    const cellW = WIDTH / cols;
    const rowHeights = rows.map((row) =>
      Math.max(
        ...row.map((cell) => {
          const inner = cellW - padX * 2;
          return (
            padY * 2 +
            p.measure(cell.label, inner, captionOpts).height +
            px(2) +
            p.measure(cell.value, inner, valueOpts).height
          );
        })
      )
    );
    const totalH = rowHeights.reduce((a, b) => a + b, 0);
    ensure(totalH);
    const box = { x: LEFT, y, w: WIDTH, h: totalH };
    if (T.meta.fill === "tint") fillRect(doc, box, T.meta.radiusPx, tint);
    if (T.meta.border === "frame") strokeRect(doc, box, T.meta.radiusPx, frameBorder);
    let ry = y;
    rows.forEach((row, rowIndex) => {
      if (rowIndex > 0) hLine(doc, LEFT + px(1), RIGHT - px(1), ry - px(0.5), T.meta.fill === "tint" && !T.meta.cellDividers ? PAPER_INK.white : PAPER_INK.line);
      row.forEach((cell, i) => {
        const cx = LEFT + i * cellW;
        if (i > 0 && T.meta.cellDividers) vLine(doc, cx, ry + px(1), ry + rowHeights[rowIndex]! - px(1), PAPER_INK.line);
        const inner = cellW - padX * 2;
        const ly = ry + padY;
        const hCap = p.put(cell.label, cx + padX, ly, inner, captionOpts);
        p.put(cell.value, cx + padX, ly + hCap + px(2), inner, valueOpts);
      });
      ry += rowHeights[rowIndex]!;
    });
    if (T.meta.bottomRule) hLine(doc, LEFT, RIGHT, y + totalH - px(1), PAPER_INK.line);
    y += totalH + GAP;
  };

  // ----- parties ------------------------------------------------------------
  const drawParties = () => {
    const parties = [c.seller, c.buyer].filter((party): party is NonNullable<typeof party> => !!party);
    const cellW = WIDTH / parties.length;
    const padX = px(10);
    const padY = px(8);
    const flush = T.parties.flushCells;
    const captionOpts = { role: "head600", size: 7.5, spacing: 0.07, upper: true, color: PAPER_INK.caption } as const;
    const innerX = (i: number) => LEFT + i * cellW + (flush ? 0 : padX);
    const innerW = flush ? cellW - padX : cellW - padX * 2;
    const heights = parties.map((party) => {
      let h = padY * 2 + p.measure(party.title, innerW, captionOpts).height + px(2);
      h += p.measure(party.name, innerW, { role: "body700", size: 10.5, color: PAPER_INK.body }).height;
      for (const line of party.lines) h += p.measure(line, innerW, { role: "body400", size: 9.5, color: PAPER_INK.secondary }).height;
      return h;
    });
    const totalH = Math.max(...heights);
    ensure(totalH);
    const box = { x: LEFT, y, w: WIDTH, h: totalH };
    if (T.parties.box) strokeRect(doc, box, 8, PAPER_INK.line);
    parties.forEach((party, i) => {
      if (i > 0 && T.parties.box) vLine(doc, LEFT + i * cellW, y + px(1), y + totalH - px(1), PAPER_INK.line);
      let cy = y + padY;
      cy += p.put(party.title, innerX(i), cy, innerW, captionOpts) + px(2);
      cy += p.put(party.name, innerX(i), cy, innerW, { role: "body700", size: 10.5, color: PAPER_INK.body });
      for (const line of party.lines) {
        cy += p.put(line, innerX(i), cy, innerW, { role: "body400", size: 9.5, color: PAPER_INK.secondary });
      }
    });
    if (T.parties.bottomRule) hLine(doc, LEFT, RIGHT, y + totalH - px(1), PAPER_INK.line);
    y += totalH + GAP;
  };

  // ----- line items ---------------------------------------------------------
  type Columns = { x: number[]; w: number[]; size: number };
  const computeColumns = (): Columns => {
    const pad = px(7);
    const headOpts = { role: "head500", size: 8, spacing: 0.05, upper: true } as const;
    let size = 10;
    for (;;) {
      const keys = ["quantity", "unitPrice", "net", "vat", "total"] as const;
      const widths = [
        0,
        ...keys.map((key, index) => {
          const role: PaperFontRole = key === "total" ? "body700" : "body400";
          const content = Math.max(0, ...c.rows.map((row) => p.widthOf(row[key], { role, size })));
          return Math.max(content, p.widthOf(c.columnLabels[index + 1]!, headOpts)) + pad * 2 + 1;
        }),
      ];
      const descW = WIDTH - widths.reduce((a, b) => a + b, 0);
      if (descW >= px(110) || size <= 8) {
        widths[0] = Math.max(descW, px(60));
        // if even the floor overflows, scale the numeric columns down
        const sum = widths.reduce((a, b) => a + b, 0);
        if (sum > WIDTH + 0.5) {
          const k = (WIDTH - widths[0]!) / (sum - widths[0]!);
          for (let i = 1; i < 6; i += 1) widths[i] = widths[i]! * k;
        }
        const x: number[] = [];
        let cx = LEFT;
        for (const w of widths) {
          x.push(cx);
          cx += w;
        }
        return { x, w: widths, size };
      }
      size -= 0.5;
    }
  };

  const drawItemsHeader = (cols: Columns, atY: number): number => {
    const pad = px(7);
    const opts = { role: "head500", size: 8, spacing: 0.05, upper: true } as const;
    const h = px(5) * 2 + p.lineHeight(8);
    const fill = T.itemsHeader === "fill";
    if (fill) fillRect(doc, { x: LEFT, y: atY, w: WIDTH, h }, 0, ink);
    c.columnLabels.forEach((label, i) => {
      p.put(label, cols.x[i]! + pad, atY + px(5), cols.w[i]! - pad * 2, {
        ...opts,
        color: fill ? PAPER_INK.white : ink,
        align: i === 0 ? "left" : "right",
      });
    });
    if (!fill) hLine(doc, LEFT, RIGHT, atY + h - px(2), ink, 2);
    return atY + h;
  };

  const drawItems = () => {
    const cols = computeColumns();
    const pad = px(7);
    const descW = cols.w[0]! - pad * 2;
    const headerH = px(5) * 2 + p.lineHeight(8);
    ensure(headerH + px(30));
    y = drawItemsHeader(cols, y);
    let rowsStart = y;
    for (const row of c.rows) {
      const descM = p.measure(row.description, descW, { role: "body700", size: cols.size, color: PAPER_INK.body });
      const noteH = row.note ? p.measure(row.note, descW, { role: "body400", size: 9.5, color: PAPER_INK.secondary }).height : 0;
      const rowH = px(6) * 2 + Math.max(descM.height + noteH, p.lineHeight(cols.size)) + px(1);
      if (y > rowsStart + 0.5 && y + rowH > CONTENT_BOTTOM) {
        newPage();
        y = drawItemsHeader(cols, y);
        rowsStart = y;
      }
      const ry = y + px(6);
      p.put(row.description, cols.x[0]! + pad, ry, descW, { role: "body700", size: cols.size, color: PAPER_INK.body });
      if (row.note) {
        p.put(row.note, cols.x[0]! + pad, ry + descM.height, descW, { role: "body400", size: 9.5, color: PAPER_INK.secondary });
      }
      const numeric: Array<[string, PaperFontRole, string]> = [
        [row.quantity, "body400", PAPER_INK.body],
        [row.unitPrice, "body400", PAPER_INK.body],
        [row.net, "body400", PAPER_INK.body],
        [row.vat, "body400", PAPER_INK.body],
        [row.total, "body700", PAPER_INK.body],
      ];
      numeric.forEach(([text, role, color], i) => {
        p.put(text, cols.x[i + 1]! + pad, ry, cols.w[i + 1]! - pad * 2, {
          role,
          size: cols.size,
          color,
          align: "right",
          single: true,
        });
      });
      hLine(doc, LEFT, RIGHT, y + rowH - px(1), PAPER_INK.rowRule);
      y += rowH;
    }
    y += GAP;
  };

  // ----- ÁFA-összesítő + totals --------------------------------------------
  const drawSummary = () => {
    const totW = WIDTH * 0.55;
    const totX = RIGHT - totW;
    const rowOpts = (role: PaperFontRole, color: string) => ({ role, size: 10, color });
    const grandValueSize = (() => {
      let size = 15;
      const room = totW - p.widthOf(c.due.label, { role: "head600", size: 7.5, spacing: 0.07, upper: true }) - px(12);
      while (p.widthOf(c.due.value, { role: "body700", size }) > room && size > 10) size -= 0.5;
      return size;
    })();
    const rowLH = p.lineHeight(10);
    const grandLH = p.lineHeight(grandValueSize, 1.25);
    const totalsH =
      c.totalsRows.length * rowLH +
      c.totalsRows.length * px(3) +
      px(4) +
      px(2) +
      px(6) +
      grandLH;

    // VAT summary table
    const vs = c.vatSummary;
    const vPad = px(3.5);
    const vHead = { role: "head500", size: 7, spacing: 0.05, upper: true } as const;
    const vSize = 8.5;
    const colNeeds = [0, 1, 2, 3].map((i) =>
      Math.max(
        p.widthOf(vs.header[i]!, vHead),
        ...vs.rows.map((row) => p.widthOf(row[i]!, { role: "body400", size: vSize }))
      ) + vPad * 2 + 1
    );
    const needW = colNeeds.reduce((a, b) => a + b, 0);
    const sideW = WIDTH - totW - px(8);
    const sideBySide = needW <= sideW;
    // Too wide for the column beside the totals: a block above them instead.
    const vatW = sideBySide ? sideW : Math.min(WIDTH, Math.max(needW, totW));
    const extra = (vatW - needW) / 3;
    const vatCols = colNeeds.map((w, i) => (i === 0 ? w : w + extra));
    const capH = p.lineHeight(7.5);
    const vHeadH = px(4) * 2 + p.lineHeight(7);
    const vRowH = px(3) * 2 + p.lineHeight(vSize) + px(1);
    const vatH = capH + px(4) + vHeadH + vs.rows.length * vRowH;
    const totalH = sideBySide ? Math.max(vatH, totalsH) : vatH + GAP + totalsH;
    ensure(totalH);

    // -- VAT table
    const fill = T.itemsHeader === "fill";
    let vy = y;
    p.put(vs.caption, LEFT, vy, vatW, { role: "head600", size: 7.5, spacing: 0.07, upper: true, color: PAPER_INK.caption });
    vy += capH + px(4);
    if (fill) fillRect(doc, { x: LEFT, y: vy, w: vatW, h: vHeadH }, 0, ink);
    let vx = LEFT;
    vs.header.forEach((label, i) => {
      p.put(label, vx + vPad, vy + px(4), vatCols[i]! - vPad * 2, {
        ...vHead,
        color: fill ? PAPER_INK.white : ink,
        align: i === 0 ? "left" : "right",
      });
      vx += vatCols[i]!;
    });
    if (!fill) hLine(doc, LEFT, LEFT + vatW, vy + vHeadH - px(1.5), ink, 1.5);
    vy += vHeadH;
    for (const row of vs.rows) {
      vx = LEFT;
      row.forEach((cell, i) => {
        p.put(cell, vx + vPad, vy + px(3), vatCols[i]! - vPad * 2, {
          role: "body400",
          size: vSize,
          color: PAPER_INK.totalsLabel,
          align: i === 0 ? "left" : "right",
          single: true,
        });
        vx += vatCols[i]!;
      });
      hLine(doc, LEFT, LEFT + vatW, vy + vRowH - px(1), PAPER_INK.rowRule);
      vy += vRowH;
    }

    // -- totals
    let ty = sideBySide ? y : y + vatH + GAP;
    for (const row of c.totalsRows) {
      p.put(row.label, totX, ty, totW * 0.55, rowOpts("body400", PAPER_INK.totalsLabel));
      p.put(row.value, totX + totW * 0.45, ty, totW * 0.55, { ...rowOpts("body400", PAPER_INK.body), align: "right" });
      ty += rowLH + px(3);
    }
    ty += px(4);
    fillRect(doc, { x: totX, y: ty, w: totW, h: px(2) }, 0, ink);
    ty += px(2) + px(6);
    const valueBase = p.baselineOffset("body700", grandValueSize, 1.25);
    const capBase = p.baselineOffset("head600", 7.5);
    p.put(c.due.label, totX, ty + valueBase - capBase, totW * 0.5, {
      role: "head600",
      size: 7.5,
      spacing: 0.07,
      upper: true,
      color: PAPER_INK.caption,
    });
    p.put(c.due.value, totX + totW * 0.3, ty, totW * 0.7, {
      role: "body700",
      size: grandValueSize,
      color: PAPER_INK.grand,
      align: "right",
      lh: 1.25,
    });
    y += totalH + GAP;
  };

  // ----- ÁFA exemption / reverse-charge statement ---------------------------
  const drawStatement = () => {
    if (c.exemptionReasons.length === 0) return;
    const padX = px(10);
    const padY = px(8);
    const barW = px(3);
    const innerW = WIDTH - padX * 2 - barW;
    const opts = { role: "body400", size: 10, color: PAPER_INK.note } as const;
    const gapBetween = px(3);
    const h =
      padY * 2 +
      c.exemptionReasons.reduce((sum, reason) => sum + p.measure(reason, innerW, opts).height + gapBetween, 0) -
      gapBetween;
    ensure(h);
    const box = { x: LEFT, y, w: WIDTH, h };
    if (T.statement.fill === "tint") fillRect(doc, box, 0, tint);
    if (T.statement.fill === "box") strokeRect(doc, box, 8, PAPER_INK.line);
    const barInset = T.statement.fill === "box" ? px(5) : 0;
    fillRect(doc, { x: LEFT + (T.statement.fill === "box" ? px(1) : 0), y: y + barInset, w: barW, h: h - barInset * 2 }, T.statement.fill === "box" ? 1.5 : 0, ink);
    let ry = y + padY;
    for (const reason of c.exemptionReasons) {
      ry += p.put(reason, LEFT + barW + padX, ry, innerW, opts) + gapBetween;
    }
    y += h + GAP;
  };

  // ----- payment strip ------------------------------------------------------
  const drawPayment = () => {
    if (!c.payment) return;
    const cells = c.payment.cells;
    const weights = cells.length === 1 ? [1] : cells.length === 2 ? [1.4, 1] : [1.4, 1, 1];
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => (WIDTH * w) / weightSum);
    const padX = px(10);
    const padY = px(8);
    const flush = T.strip.flushCells;
    const captionOpts = { role: "head600", size: 7.5, spacing: 0.07, upper: true, color: PAPER_INK.caption } as const;
    const valueOpts = { role: "body700", size: 11, spacing: 0.02, color: PAPER_INK.body } as const;
    const innerWidth = (i: number) => widths[i]! - (flush ? padX : padX * 2);
    const cellH = Math.max(
      ...cells.map(
        (cell, i) =>
          padY * 2 +
          p.measure(cell.label, innerWidth(i), captionOpts).height +
          px(2) +
          p.measure(cell.value, innerWidth(i), valueOpts).height
      )
    );
    const titleH = p.lineHeight(7.5) + px(4);
    ensure(titleH + cellH);
    p.put(c.payment.caption, LEFT, y, WIDTH, captionOpts);
    y += titleH;
    const box = { x: LEFT, y, w: WIDTH, h: cellH };
    if (T.strip.fill === "tint") fillRect(doc, box, 0, tint);
    if (T.strip.box) strokeRect(doc, box, 8, PAPER_INK.line);
    if (T.strip.topRule) hLine(doc, LEFT, RIGHT, y, PAPER_INK.line);
    let cx = LEFT;
    cells.forEach((cell, i) => {
      if (i > 0 && T.strip.cellDividers) vLine(doc, cx, y + px(1), y + cellH - px(1), PAPER_INK.line);
      const tx = cx + (flush ? 0 : padX);
      const hCap = p.put(cell.label, tx, y + padY, innerWidth(i), captionOpts);
      p.put(cell.value, tx, y + padY + hCap + px(2), innerWidth(i), valueOpts);
      cx += widths[i]!;
    });
    y += cellH + GAP;
  };

  // ----- notes (flows across pages) -----------------------------------------
  const drawNotes = () => {
    if (!c.notes) return;
    const nx = LEFT + px(2);
    const nw = WIDTH - px(4);
    const captionOpts = { role: "head600", size: 7.5, spacing: 0.07, upper: true, color: PAPER_INK.caption } as const;
    const bodyOpts = { role: "body400", size: 10, color: PAPER_INK.note } as const;
    const capH = p.lineHeight(7.5) + px(2);
    const body = p.measure(c.notes, nw, bodyOpts);
    // The caption is never orphaned: reserve it plus the first ~3 lines.
    ensure(px(2) + capH + Math.min(body.height, body.lineH * 3));
    p.put(c.notesLabel, nx, y + px(2), nw, captionOpts);
    y += px(2) + capH;

    p.setFont(bodyOpts.role, bodyOpts.size);
    const base = doc.currentLineHeight();
    doc.fillColor(bodyOpts.color);

    // Notes paginate INSIDE the single doc.text() call (pdfkit's own
    // auto-pagination at CONTENT_BOTTOM); this listener runs between its
    // addPage() and the resumed text, draws the continuation banner and the
    // repeated caption, and hands the text state back.
    let drawing = false;
    const onPageAdded = () => {
      if (drawing) return;
      drawing = true;
      try {
        let by = drawBanner(doc.y);
        by += p.put(c.notesContinuedLabel, nx, by, nw, captionOpts) + px(2);
        doc.y = by;
        p.setFont(bodyOpts.role, bodyOpts.size);
        doc.fillColor(bodyOpts.color);
      } finally {
        drawing = false;
      }
    };
    doc.on("pageAdded", onPageAdded);
    try {
      doc.text(c.notes, nx, y + (body.lineH - base) / 2, { width: nw, lineGap: Math.max(0, body.lineH - base) });
    } finally {
      doc.off("pageAdded", onPageAdded);
    }
    y = doc.y;
  };

  // ----- footer + watermark on every page -----------------------------------
  const drawFooters = () => {
    const range = doc.bufferedPageRange();
    const total = range.count;
    for (let i = range.start; i < range.start + total; i += 1) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      if (c.isUnnumberedDraft) drawWatermark();

      hLine(doc, LEFT, RIGHT, FOOTER_TOP, PAPER_INK.footerRule);
      const ty = FOOTER_TOP + px(1) + px(8);
      const small = { role: "body400", size: 9.5 } as const;
      p.put(c.footerText, LEFT, ty, WIDTH * 0.42, { ...small, color: PAPER_INK.caption, single: true });
      if (total > 1) {
        p.put(c.pageIndicator(i - range.start + 1, total), LEFT + WIDTH * 0.42, ty, WIDTH * 0.16, {
          ...small,
          color: PAPER_INK.caption,
          align: "center",
          single: true,
        });
      }
      // Text only, no brand mark; the muted document ink keeps >= 4.5:1.
      p.put(c.footerAttribution, RIGHT - WIDTH * 0.42, ty, WIDTH * 0.42, {
        ...small,
        color: documentInk.muted,
        align: "right",
        single: true,
      });
      doc.page.margins.bottom = savedBottom;
    }
  };

  const drawWatermark = () => {
    const size = 79;
    const label = c.labels.draftNumber;
    const cx = A4_WIDTH_PT / 2;
    const cy = A4_HEIGHT_PT * 0.48;
    const w = p.widthOf(label, { role: "head700", size });
    p.setFont("head700", size);
    const h = doc.currentLineHeight();
    doc.save();
    doc.rotate(-24, { origin: [cx, cy] });
    doc.fillColor(v.accentColor).fillOpacity(0.07);
    doc.text(label, cx - w / 2, cy - h / 2, { lineBreak: false });
    doc.restore();
  };

  // ----- go -------------------------------------------------------------------
  drawHeader();
  drawReference();
  drawMeta();
  drawParties();
  drawItems();
  drawSummary();
  drawStatement();
  drawPayment();
  drawNotes();
  drawFooters();
}
