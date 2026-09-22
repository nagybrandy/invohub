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

// The buyer's address printed on the document (Áfa tv. 169. § e) is a
// SNAPSHOT captured directly on the invoice row at save time (see
// db/schema.ts's clientZipCode/clientCity/clientAddress/clientCountry/
// clientEuVatNumber, and lib/invoices/mappers.ts). Invoices saved before
// that snapshot existed have none of those columns set, so this falls back
// to the linked partner row for those — which may have moved since, but is
// still better than no address at all. Missing/deleted partner and no
// snapshot -> no address block, never a throw.
function snapshotBuyer(invoice: Invoice): InvoicePdfBuyer | undefined {
  const hasSnapshot =
    invoice.clientZipCode || invoice.clientCity || invoice.clientAddress || invoice.clientCountry || invoice.clientEuVatNumber;
  if (!hasSnapshot) return undefined;
  return {
    address: invoice.clientAddress,
    city: invoice.clientCity,
    zipCode: invoice.clientZipCode,
    country: invoice.clientCountry,
    euVatNumber: invoice.clientEuVatNumber,
  };
}

async function loadBuyerFromClient(
  userId: string,
  clientId?: string
): Promise<InvoicePdfBuyer | undefined> {
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

async function loadBuyer(userId: string, invoice: Invoice): Promise<InvoicePdfBuyer | undefined> {
  const fromSnapshot = snapshotBuyer(invoice);
  if (fromSnapshot) return fromSnapshot;
  return loadBuyerFromClient(userId, invoice.clientId);
}

export async function buildInvoicePdfContext(
  userId: string,
  invoice: Invoice
): Promise<InvoicePdfContext> {
  const [company, template, buyer] = await Promise.all([
    getCompanyByUserId(userId),
    getPdfTemplate(userId),
    loadBuyer(userId, invoice),
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
