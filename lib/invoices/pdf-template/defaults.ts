// lib/invoices/pdf-template/defaults.ts
// Default PDF template values for new users.
import type { InvoicePdfTemplate, PdfFontScale } from "@/lib/invoices/pdf-template/types";

export const DEFAULT_PDF_TEMPLATE: InvoicePdfTemplate = {
  titleText: "INVOICE",
  accentColor: "#4f46e5",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Thank you for your business.",
  notesLabel: "Notes",
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
