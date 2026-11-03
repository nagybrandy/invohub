// lib/invoices/build-pdf-context.ts
// Loads company, buyer address + PDF template for invoice PDF generation.
import { getClientById } from "@/lib/clients/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import type { InvoicePdfBuyer, InvoicePdfCompany, InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";
import {
  getInvoicePdfTemplateSnapshot,
  getLegacyAppearance,
  getPdfTemplate,
} from "@/lib/invoices/pdf-template/service";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { getInvoiceById } from "@/lib/invoices/service";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";

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

// An issued document keeps the appearance it was issued with (frozen by
// upsertInvoice when it got its number). Only drafts follow the live template
// (and so Dóri's design for a user without a saved one). An invoice issued
// before snapshots existed was always drawn by the legacy renderer: it keeps
// following the user's stored colours/toggles (until they change the template
// and the freeze step pins them), but always on the legacy layout, for users
// with and without a stored row alike.
async function loadTemplate(userId: string, invoice: Invoice): Promise<InvoicePdfTemplate> {
  if (invoice.status !== "draft" && hasInvoiceNumber(invoice)) {
    const snapshot = await getInvoicePdfTemplateSnapshot(userId, invoice.id);
    if (snapshot) return snapshot;
    return getLegacyAppearance(userId);
  }
  return getPdfTemplate(userId);
}

export async function buildInvoicePdfContext(
  userId: string,
  invoice: Invoice
): Promise<InvoicePdfContext> {
  const referencedId = invoice.modifiesInvoiceId ?? invoice.originalInvoiceId;
  const [company, template, buyer, referenced] = await Promise.all([
    getCompanyByUserId(userId),
    loadTemplate(userId, invoice),
    loadBuyer(userId, invoice),
    referencedId ? getInvoiceById(userId, referencedId) : Promise.resolve(null),
  ]);

  return {
    invoice,
    company: mapCompany(company),
    buyer,
    template,
    referencedInvoiceNumber: referenced?.invoiceNumber || undefined,
  };
}

export async function buildSamplePdfContext(userId: string): Promise<InvoicePdfContext> {
  const invoice = buildSamplePreviewInvoice();
  return buildInvoicePdfContext(userId, invoice);
}
