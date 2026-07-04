// lib/invoices/pdf-template/types.ts
// User-configurable invoice PDF appearance settings.
export type PdfFontScale = "small" | "medium" | "large";

export type InvoicePdfTemplate = {
  titleText: string;
  accentColor: string;
  showCompanyBlock: boolean;
  showBankDetails: boolean;
  showClientTaxNumber: boolean;
  footerText: string;
  notesLabel: string;
  fontScale: PdfFontScale;
};

export type InvoicePdfTemplateInput = Partial<InvoicePdfTemplate>;
