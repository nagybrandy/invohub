// lib/invoices/build-pdf-context.ts
// Loads company, buyer address + PDF template for invoice PDF generation.
import { getClientById } from "@/lib/clients/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import type { InvoicePdfBuyer, InvoicePdfCompany, InvoicePdfContext } from "@/lib/invoices/generate-pdf";
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

// The invoice row itself only stores the buyer's name and tax number; the
// address the document must print (Áfa tv. 169. § e) lives on the linked
// partner. Missing/deleted partner -> no address block, never a throw.
async function loadBuyer(userId: string, clientId?: string): Promise<InvoicePdfBuyer | undefined> {
  if (!clientId) return undefined;
  const partner = await getClientById(userId, clientId);
  if (!partner) return undefined;
  return {
    address: partner.address ?? undefined,
    city: partner.city ?? undefined,
    zipCode: partner.zipCode ?? undefined,
    country: partner.country ?? undefined,
    euVatNumber: partner.euVatNumber ?? undefined,
  };
}

export async function buildInvoicePdfContext(
  userId: string,
  invoice: Invoice
): Promise<InvoicePdfContext> {
  const [company, template, buyer] = await Promise.all([
    getCompanyByUserId(userId),
    getPdfTemplate(userId),
    loadBuyer(userId, invoice.clientId),
  ]);

  return {
    invoice,
    company: mapCompany(company),
    buyer,
    template,
  };
}

export async function buildSamplePdfContext(userId: string): Promise<InvoicePdfContext> {
  const invoice = buildSamplePreviewInvoice();
  return buildInvoicePdfContext(userId, invoice);
}
