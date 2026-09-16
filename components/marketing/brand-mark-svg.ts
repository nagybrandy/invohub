// components/marketing/brand-mark-svg.ts
// Pure string serializer for the InvoHub brand mark — no React, no
// react-native-svg, so server-side code (lib/invoices/preview-html.ts) can
// call it directly to inline the mark into the HTML invoice preview.
// Mirrors BrandShapeGroup's paint rules (components/marketing/
// BrandShapes.tsx) exactly, just emitted as markup text. Reads
// BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT] directly (see
// docs/plans/2026-09-16-pdf-invohub-brand-mark.md AC13) — the same
// constant lib/invoices/pdf-brand-mark.ts reads for the PDF rendering, so
// both stay in sync from a single source of truth.
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  type BrandShape,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";

export type BrandMarkSvgOptions = {
  /** Rendered edge length in px. Defaults to the viewBox edge (48). */
  size?: number;
  /** Frame ink. Defaults to landingColors.navy. */
  ink?: string;
  /** Flow ink. Defaults to landingColors.cornflower. */
  accent?: string;
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function shapeMarkup(shape: BrandShape, color: string, rounded: boolean): string {
  const stroked = shape.stroke !== undefined;
  const cap = shape.kind === "path" && shape.cap ? shape.cap : rounded ? "round" : "butt";
  const join = rounded ? "round" : "miter";
  const paint = stroked
    ? `fill="none" stroke="${color}" stroke-width="${shape.stroke}" stroke-linecap="${cap}" stroke-linejoin="${join}"`
    : `fill="${color}" stroke="none"`;

  if (shape.kind === "circle") {
    return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${paint} />`;
  }
  return `<path d="${escapeAttr(shape.d)}" ${paint} />`;
}

/** An inline `<svg viewBox="0 0 48 48">…</svg>` string of the InvoHub mark. */
export function brandMarkSvg(opts: BrandMarkSvgOptions = {}): string {
  const size = opts.size ?? BRAND_MARK_VIEWBOX;
  const ink = opts.ink ?? landingColors.navy;
  const accent = opts.accent ?? landingColors.cornflower;
  const geometry = BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT];

  const shapesMarkup = [
    ...geometry.frame.map((shape) => shapeMarkup(shape, ink, geometry.rounded)),
    ...geometry.flow.map((shape) => shapeMarkup(shape, accent, geometry.rounded)),
  ].join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}" role="img" aria-label="InvoHub" xmlns="http://www.w3.org/2000/svg">${shapesMarkup}</svg>`;
}
