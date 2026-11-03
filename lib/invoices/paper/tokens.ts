// lib/invoices/paper/tokens.ts
// Design tokens of Dóri's invoice paper (docs/design/invoice-paper-2026-11/
// paper-css.md). The three layouts (Letisztult / Sávos / Keretes) differ only
// by data here; render-paper.ts has one code path that reads these tokens.
import { paperPalette, type PaperPalette } from "@/lib/invoices/paper/brand-color";
import type {
  InvoicePdfTemplate,
  PdfFontStyle,
  PdfLayout,
  PdfLogoMode,
  PdfLogoPosition,
  PdfLogoSize,
} from "@/lib/invoices/pdf-template/types";

/** The paper is designed as a 560 x 790 px box; A4 is 595.28 pt wide. */
export const PAPER_DESIGN_WIDTH_PX = 560;
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;
export const PX = A4_WIDTH_PT / PAPER_DESIGN_WIDTH_PX;
export const px = (n: number): number => n * PX;

export const PAPER_PAGE = {
  /** top / left / right padding, design px */
  marginPx: 34,
  /** 20 px bottom padding + 22 px footer */
  footerBandPx: 42,
  /** gap between the last content block and the footer rule */
  footerGapPx: 12,
  /** gap between every pair of blocks */
  blockGapPx: 12,
} as const;

export const LOGO_SIZE_PX: Record<PdfLogoSize, number> = { S: 22, M: 30, L: 42 };
export const LOGO_MAX_WIDTH_PX = 120;

/** Fixed inks of the paper (the paper is always white, also in dark mode). */
export const PAPER_INK = {
  body: "#222222",
  secondary: "#666666",
  caption: "#555555",
  note: "#333333",
  totalsLabel: "#444444",
  grand: "#111111",
  rowRule: "#EEEEEE",
  footerRule: "#E5E6EA",
  line: "#E6E8EC",
  tagBackground: "#EEF0F4",
  tagText: "#555555",
  white: "#FFFFFF",
} as const;

export type PaperLayout = Exclude<PdfLayout, "legacy">;

export type LayoutTokens = {
  meta: {
    fill: "none" | "tint";
    radiusPx: number;
    border: "none" | "frame";
    cellDividers: boolean;
    bottomRule: boolean;
  };
  parties: {
    box: boolean;
    bottomRule: boolean;
    /** the two cells start flush with the content edge / the column boundary */
    flushCells: boolean;
  };
  /** "fill": ink fill, white labels; "underline": ink labels over a 2 px ink rule */
  itemsHeader: "fill" | "underline";
  strip: { fill: "none" | "tint"; box: boolean; topRule: boolean; cellDividers: boolean; flushCells: boolean };
  statement: { fill: "none" | "tint" | "box" };
};

export const LAYOUT_TOKENS: Record<PaperLayout, LayoutTokens> = {
  clean: {
    meta: { fill: "none", radiusPx: 0, border: "none", cellDividers: false, bottomRule: true },
    parties: { box: false, bottomRule: true, flushCells: true },
    itemsHeader: "underline",
    strip: { fill: "none", box: false, topRule: true, cellDividers: false, flushCells: true },
    statement: { fill: "none" },
  },
  band: {
    meta: { fill: "tint", radiusPx: 0, border: "none", cellDividers: false, bottomRule: false },
    parties: { box: false, bottomRule: false, flushCells: true },
    itemsHeader: "fill",
    strip: { fill: "tint", box: false, topRule: false, cellDividers: false, flushCells: false },
    statement: { fill: "tint" },
  },
  frame: {
    meta: { fill: "tint", radiusPx: 8, border: "frame", cellDividers: true, bottomRule: false },
    parties: { box: true, bottomRule: false, flushCells: false },
    itemsHeader: "fill",
    strip: { fill: "none", box: true, topRule: false, cellDividers: true, flushCells: false },
    statement: { fill: "box" },
  },
};

export type PaperVariant = {
  layout: PaperLayout;
  tokens: LayoutTokens;
  fontStyle: PdfFontStyle;
  logo: { mode: PdfLogoMode; sizePx: number; position: PdfLogoPosition };
  palette: PaperPalette;
  /** the colour as the user chose it (watermark tint) */
  accentColor: string;
};

/** Everything the one paper renderer needs to know about the chosen look. */
export function paperVariant(template: InvoicePdfTemplate): PaperVariant {
  const layout: PaperLayout = template.layout === "legacy" ? "frame" : template.layout;
  return {
    layout,
    tokens: LAYOUT_TOKENS[layout],
    fontStyle: template.fontStyle,
    logo: {
      mode: template.logoMode,
      sizePx: LOGO_SIZE_PX[template.logoSize],
      position: template.logoPosition,
    },
    palette: paperPalette(template.accentColor),
    accentColor: template.accentColor,
  };
}
