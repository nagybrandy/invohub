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

/**
 * Reads an invoice's stored appearance snapshot (invoice.pdf_template_snapshot,
 * untyped JSON) back into a template. null when there is none. Only the known
 * fields of the right type are kept — anything else falls back to the default
 * — and the colour is normalized, for the same reason getPdfTemplate
 * re-normalizes its row: render safety must not depend on what is stored.
 */
export function parsePdfTemplateSnapshot(value: unknown): InvoicePdfTemplate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const text = (key: "titleText" | "footerText" | "notesLabel") =>
    typeof raw[key] === "string" ? (raw[key] as string) : DEFAULT_PDF_TEMPLATE[key];
  const flag = (key: "showCompanyBlock" | "showBankDetails" | "showClientTaxNumber") =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : DEFAULT_PDF_TEMPLATE[key];
  return {
    titleText: text("titleText"),
    accentColor: normalizeHexColor(typeof raw.accentColor === "string" ? raw.accentColor : ""),
    showCompanyBlock: flag("showCompanyBlock"),
    showBankDetails: flag("showBankDetails"),
    showClientTaxNumber: flag("showClientTaxNumber"),
    footerText: text("footerText"),
    notesLabel: text("notesLabel"),
    fontScale: PDF_FONT_SCALES.includes(raw.fontScale as PdfFontScale)
      ? (raw.fontScale as PdfFontScale)
      : DEFAULT_PDF_TEMPLATE.fontScale,
  };
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
