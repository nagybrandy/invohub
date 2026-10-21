// lib/invoices/pdf-template/defaults.ts
// Default PDF template values for new users.
import type { InvoicePdfTemplate, PdfFontScale } from "@/lib/invoices/pdf-template/types";

export const DEFAULT_PDF_TEMPLATE: InvoicePdfTemplate = {
  titleText: "SZÁMLA",
  accentColor: "#6495ed",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmat!",
  notesLabel: "Megjegyzés",
  fontScale: "medium",
};

export const PDF_FONT_SCALES: PdfFontScale[] = ["small", "medium", "large"];

export function pdfFontSizes(scale: PdfFontScale): {
  title: number;
  subtitle: number;
  body: number;
  small: number;
} {
  switch (scale) {
    case "small":
      return { title: 16, subtitle: 11, body: 8, small: 8 };
    case "large":
      return { title: 24, subtitle: 13, body: 10, small: 9 };
    case "medium":
    default:
      return { title: 20, subtitle: 12, body: 9, small: 9 };
  }
}

export function mergePdfTemplate(
  input: Partial<InvoicePdfTemplate> | null | undefined
): InvoicePdfTemplate {
  return {
    ...DEFAULT_PDF_TEMPLATE,
    ...input,
  };
}

export function normalizeHexColor(color: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return DEFAULT_PDF_TEMPLATE.accentColor;
}

const ENGLISH_DEFAULTS = {
  titleText: "INVOICE",
  footerText: "Thank you for your business!",
  notesLabel: "Note",
} as const;

/**
 * For an English document the three DEFAULT Hungarian template texts become
 * their English equivalents. A text the user customised (anything that is not
 * exactly the default) is theirs and is left alone.
 */
export function localizePdfTemplate(
  template: InvoicePdfTemplate,
  locale: "hu" | "en"
): InvoicePdfTemplate {
  if (locale !== "en") return template;
  return {
    ...template,
    titleText: template.titleText === DEFAULT_PDF_TEMPLATE.titleText ? ENGLISH_DEFAULTS.titleText : template.titleText,
    footerText: template.footerText === DEFAULT_PDF_TEMPLATE.footerText ? ENGLISH_DEFAULTS.footerText : template.footerText,
    notesLabel: template.notesLabel === DEFAULT_PDF_TEMPLATE.notesLabel ? ENGLISH_DEFAULTS.notesLabel : template.notesLabel,
  };
}
