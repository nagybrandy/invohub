// lib/nav/invoice-xml.ts
// NAV Online Számla–style invoice XML builder (MVP structure for stub submit).
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";
import type { Company } from "@/lib/companies/service";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildNavInvoiceXml(
  invoice: Invoice,
  company: Company | null
): string {
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const supplierTax = company?.taxNumber ?? "00000000-0-00";
  const supplierName = company?.name ?? "InvoHub User";
  const customerTax = invoice.clientTaxNumber ?? "";

  const lines = invoice.lineItems
    .map(
      (line, index) => `
    <lineItem index="${index + 1}">
      <description>${escapeXml(line.description)}</description>
      <quantity>${line.quantity}</quantity>
      <unitPrice>${line.unitPrice}</unitPrice>
      <vatRate>${line.vatRate}</vatRate>
    </lineItem>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0">
  <invoiceNumber>${escapeXml(invoice.invoiceNumber)}</invoiceNumber>
  <issueDate>${escapeXml(invoice.issueDate)}</issueDate>
  <dueDate>${escapeXml(invoice.dueDate)}</dueDate>
  <currency>${escapeXml(invoice.currency)}</currency>
  <supplier>
    <name>${escapeXml(supplierName)}</name>
    <taxNumber>${escapeXml(supplierTax)}</taxNumber>
  </supplier>
  <customer>
    <name>${escapeXml(invoice.clientName)}</name>
    ${customerTax ? `<taxNumber>${escapeXml(customerTax)}</taxNumber>` : ""}
  </customer>
  <lineItems>${lines}
  </lineItems>
  <totals>
    <netAmount>${totals.subtotal}</netAmount>
    <vatAmount>${totals.vatTotal}</vatAmount>
    <grossAmount>${totals.totalAmount}</grossAmount>
  </totals>
</InvoiceData>`;
}
