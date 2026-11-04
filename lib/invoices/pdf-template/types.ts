// lib/invoices/pdf-template/types.ts
// User-configurable invoice PDF appearance settings.
export type PdfFontScale = "small" | "medium" | "large";

/**
 * "legacy" is the document renderer that existed before the 2026-11 paper
 * redesign, frozen byte for byte so an already-issued invoice never changes
 * appearance. The other three are Dóri's Letisztult / Sávos / Keretes.
 */
export type PdfLayout = "legacy" | "clean" | "band" | "frame";
/** Heading + body font pairing: InvoHub, Klasszikus, Kerek. */
export type PdfFontStyle = "invohub" | "classic" | "round";
export type PdfLogoMode = "monogram" | "own" | "none";
export type PdfLogoSize = "S" | "M" | "L";
export type PdfLogoPosition = "left" | "right";

export type InvoicePdfTemplate = {
  titleText: string;
  accentColor: string;
  showCompanyBlock: boolean;
  showBankDetails: boolean;
  showClientTaxNumber: boolean;
  footerText: string;
  notesLabel: string;
  /** Used by the legacy layout only; the paper layouts use the design's fixed sizes. */
  fontScale: PdfFontScale;
  layout: PdfLayout;
  /** The fields below are ignored by the legacy layout. */
  fontStyle: PdfFontStyle;
  logoMode: PdfLogoMode;
  logoSize: PdfLogoSize;
  logoPosition: PdfLogoPosition;
};

export type InvoicePdfTemplateInput = Partial<InvoicePdfTemplate>;
