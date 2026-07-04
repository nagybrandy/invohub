// lib/invoices/build-pdf-context.ts
// Loads company + PDF template for invoice PDF generation.
import { getCompanyByUserId } from "@/lib/companies/service";
import type { InvoicePdfCompany, InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";
import { getPdfTemplate } from "@/lib/invoices/pdf-template/service";
import type { Invoice } from "@/lib/invoices/types";

function mapCompany(
  company: Awaited<ReturnType<typeof getCompanyByUserId>>
): InvoicePdfCompany | undefined {
  if (!company) return undefined;
  return {
    name: company.name,
    taxNumber: company.taxNumber ?? undefined,
    address: company.address ?? undefined,
    city: company.city ?? undefined,
    zipCode: company.zipCode ?? undefined,
    country: company.country ?? undefined,
    bankAccount: company.bankAccount ?? undefined,
    logoUrl: company.logoUrl ?? undefined,
  };
}

export async function buildInvoicePdfContext(
  userId: string,
  invoice: Invoice
): Promise<InvoicePdfContext> {
  const [company, template] = await Promise.all([
    getCompanyByUserId(userId),
    getPdfTemplate(userId),
  ]);

  return {
    invoice,
    company: mapCompany(company),
    template,
  };
}

export async function buildSamplePdfContext(userId: string): Promise<InvoicePdfContext> {
  const invoice = buildSamplePreviewInvoice();
  return buildInvoicePdfContext(userId, invoice);
}
