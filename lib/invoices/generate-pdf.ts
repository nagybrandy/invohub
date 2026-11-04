// lib/invoices/generate-pdf.ts
// Server-side invoice PDF generation (pdfkit). This is the ONLY entry point:
// every in-app preview (detail, list drawer, the composer's live side panel
// via POST /api/invoices/preview/pdf, the Számla testreszabása sample) and
// every outgoing document (download, v1 API, e-mail attachment) goes through
// generateInvoicePdf, so what the user previews is exactly what the customer
// receives.
//
// It is a dispatcher over two renderers:
//   - lib/invoices/pdf-legacy.ts: the pre-2026-11 renderer, frozen byte for
//     byte (pinned by pdf-legacy.golden.test.ts). Used for every template
//     with layout "legacy" — i.e. every invoice issued before the redesign.
//   - lib/invoices/paper/render-paper.ts: Dóri's paper (Letisztult / Sávos /
//     Keretes), one parametrised renderer.
import { LEGACY_PDF_TEMPLATE, mergePdfTemplate } from "@/lib/invoices/pdf-template/defaults";
import { renderPaperPdf } from "@/lib/invoices/paper/render-paper";
import { renderLegacyPdf } from "@/lib/invoices/pdf-legacy";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import type { Invoice } from "@/lib/invoices/types";

export { fitHeaderColumn } from "@/lib/invoices/pdf-legacy";

export type InvoicePdfCompany = {
  name: string;
  taxNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  bankAccount?: string;
  logoUrl?: string;
};

/** Buyer details that live on the linked partner, not on the invoice row. */
export type InvoicePdfBuyer = {
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  euVatNumber?: string;
};

export type InvoicePdfContext = {
  invoice: Invoice;
  company?: InvoicePdfCompany;
  buyer?: InvoicePdfBuyer;
  template?: InvoicePdfTemplate;
  /**
   * Sorszám of the invoice a storno / helyesbítő document refers to — Áfa tv.
   * 170. § requires a modifying document to reference it.
   */
  referencedInvoiceNumber?: string;
};

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = (invoiceNumber || "DRAFT").replace(/[^\w.-]+/g, "_");
  return `${safe}.pdf`;
}

/**
 * The template a document is drawn with. A context without a template, or a
 * template without a layout key (every snapshot written before the paper
 * redesign), is the legacy look: missing fields come from the frozen
 * LEGACY_PDF_TEMPLATE, never from Dóri's new-user defaults.
 */
export function resolvePdfTemplate(template: InvoicePdfTemplate | undefined): InvoicePdfTemplate {
  return mergePdfTemplate(template, LEGACY_PDF_TEMPLATE);
}

export async function generateInvoicePdf(ctx: InvoicePdfContext): Promise<Buffer> {
  const template = resolvePdfTemplate(ctx.template);
  if (template.layout === "legacy") return renderLegacyPdf({ ...ctx, template });
  return renderPaperPdf({ ...ctx, template });
}
