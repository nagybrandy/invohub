// lib/invoices/pdf-brand-mark.ts
// Draws the real InvoHub brand mark directly into an invoice PDF with
// pdfkit's own vector drawing calls — no raster/SVG asset (see
// docs/plans/2026-09-16-pdf-invohub-brand-mark.md §2). Reads the same
// geometry constant every other rendering of the mark reads
// (BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT] — components/marketing/
// brand-mark-geometry.ts), so nothing about the mark is retyped here: not
// the paths, and not the inks (landingColors.navy / .cornflower). Mirrors
// BrandShapeGroup's paint rules (components/marketing/BrandShapes.tsx)
// exactly, just issued as pdfkit calls instead of React elements.
import type PDFDocument from "pdfkit";
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  type BrandShape,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";
import { documentInk } from "@/lib/invoices/document-ink";

type Doc = InstanceType<typeof PDFDocument>;

/** The mark's drawn edge length in the PDF footer strip. */
export const BRAND_MARK_PDF_SIZE = 18;

/** The mark is square — its rendered width equals its size. */
export function brandMarkWidth(size: number = BRAND_MARK_PDF_SIZE): number {
  return size;
}

function drawShapeGroup(doc: Doc, shapes: readonly BrandShape[], ink: string, rounded: boolean): void {
  const defaultCap: "round" | "butt" = rounded ? "round" : "butt";
  const join: "round" | "miter" = rounded ? "round" : "miter";

  for (const shape of shapes) {
    if (shape.kind === "circle") {
      doc.circle(shape.cx, shape.cy, shape.r);
    } else {
      doc.path(shape.d);
    }

    if (shape.stroke !== undefined) {
      // Stroked shape: never fill()ed (AC4).
      const cap = shape.kind === "path" && shape.cap ? shape.cap : defaultCap;
      doc.lineWidth(shape.stroke);
      doc.lineCap(cap);
      doc.lineJoin(join);
      doc.strokeColor(ink);
      doc.stroke();
    } else {
      // Unstroked shape: never stroke()d (AC4).
      doc.fillColor(ink);
      doc.fill();
    }
  }
}

export type DrawBrandMarkOptions = {
  /** Top-left corner of the mark's viewBox, in PDF points. */
  x: number;
  y: number;
  /** Rendered edge length, in PDF points (square). */
  size: number;
  /** Ink for the frame (bracket/heads) group. */
  ink: string;
  /** Ink for the flow (stripe/hub) group. */
  accent: string;
};

/**
 * Draws the mark at (x, y), `size` points square, reading
 * BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT] directly (AC13) — switching that
 * single constant changes this rendering with no other edit.
 *
 * Leaves the document's graphics state clean (AC5): save()/restore() are
 * balanced around the transform, and fillColor/strokeColor are reset to a
 * neutral default afterwards so the next drawn element is not tinted (same
 * discipline as drawLogoBadge in pdf-layout.ts).
 */
export function drawBrandMark(doc: Doc, opts: DrawBrandMarkOptions): void {
  const geometry = BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT];

  doc.save();
  doc.translate(opts.x, opts.y);
  doc.scale(opts.size / BRAND_MARK_VIEWBOX);

  drawShapeGroup(doc, geometry.frame, opts.ink, geometry.rounded);
  drawShapeGroup(doc, geometry.flow, opts.accent, geometry.rounded);

  doc.restore();
  doc.fillColor("#000000");
  doc.strokeColor("#000000");
}

export type DrawBrandLockupOptions = {
  /** Anchor x — the mark's left edge for align "left", the lockup's centre
   * for "center", or its right edge for "right". */
  x: number;
  y: number;
  text: string;
  font: string;
  fontSize: number;
  /** Mark edge length. Defaults to BRAND_MARK_PDF_SIZE. */
  size?: number;
  align?: "left" | "center" | "right";
};

/**
 * Draws the mark plus attribution text as one lockup (mark, 6pt gutter,
 * text vertically centred on the mark), reading
 * BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT] via drawBrandMark (AC13) and
 * landingColors.navy / .cornflower for the two inks (AC3) — never a raw
 * hex literal in this file. Returns the total drawn width so the caller
 * can lay out anything else around it.
 */
export function drawBrandLockup(doc: Doc, opts: DrawBrandLockupOptions): number {
  const size = opts.size ?? BRAND_MARK_PDF_SIZE;
  const gutter = 6;

  doc.font(opts.font).fontSize(opts.fontSize);
  const textWidth = doc.widthOfString(opts.text);
  const totalWidth = size + gutter + textWidth;

  let markX = opts.x;
  if (opts.align === "center") markX = opts.x - totalWidth / 2;
  else if (opts.align === "right") markX = opts.x - totalWidth;

  drawBrandMark(doc, {
    x: markX,
    y: opts.y,
    size,
    ink: landingColors.navy,
    accent: landingColors.cornflower,
  });

  const lineHeight = doc.currentLineHeight();
  const textY = opts.y + (size - lineHeight) / 2;

  doc.font(opts.font).fontSize(opts.fontSize).fillColor(documentInk.muted);
  doc.text(opts.text, markX + size + gutter, textY, { lineBreak: false });
  doc.fillColor("#000000");

  return totalWidth;
}
