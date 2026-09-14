// lib/nav/invoice-xml.ts
// Builds a NAV Online Számla v3.0 (OSA 3.0) InvoiceData XML document for a
// simple domestic invoice — one supplier, one customer, N lines, normal
// (non-modification) summary. Namespaces and element names/order follow the
// public schema and samples at https://github.com/nav-gov-hu/Online-Invoice
// (src/schemas/.../invoiceData.xsd, sample/Data sample/*.xml).
//
// Known simplifications (see docs/nav-test-setup.md openIssues):
//  - Only `simpleAddress` (country/postal/city) is emitted — we don't have
//    structured street/house-number data, so `detailedAddress` isn't used.
//  - `exchangeRate` is always "1" — a real EUR invoice needs the actual MNB
//    rate on the delivery date, which InvoHub doesn't track yet.
//  - `invoiceAppearance` defaults to PAPER (can be overridden).
//  - `electronicInvoiceHash` (seen in some real manageInvoice samples) is
//    not emitted — unclear if/when it's required; flagged for XSD review.
import { lineItemGrossTotal, lineItemNetTotal, lineItemVatAmount } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";
import type { Company } from "@/lib/companies/service";
import { escapeXml } from "@/lib/nav/xml-utils";

const NS_DATA = "http://schemas.nav.gov.hu/OSA/3.0/data";
const NS_BASE = "http://schemas.nav.gov.hu/OSA/3.0/base";

export type NavVatExemption = {
  /** NAV case code, e.g. "AAM" (alanyi adómentesség). */
  case: string;
  /** Free-text legal justification. */
  reason: string;
};

/**
 * Extra, schema-shaped fields another track may add to Invoice/
 * InvoiceLineItem later (vatCategory/AAM work). Optional everywhere and
 * defaulted gracefully when absent — a plain Invoice/InvoiceLineItem from
 * today's types still builds valid, schema-shaped XML.
 */
export type NavLineItemExtra = { vatExemption?: NavVatExemption };
export type NavInvoiceExtra = {
  vatExemption?: NavVatExemption;
  invoiceAppearance?: "PAPER" | "ELECTRONIC";
  invoiceDeliveryDate?: string;
};

function formatAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatRate(vatRatePercent: number): string {
  return (vatRatePercent / 100).toFixed(4);
}

function normalizeTaxNumber(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : null;
}

function taxNumberBlockXml(tag: "supplierTaxNumber" | "customerTaxNumber", taxpayerId: string): string {
  return `<${tag}>
          <base:taxpayerId>${escapeXml(taxpayerId)}</base:taxpayerId>
          <base:vatCode>2</base:vatCode>
        </${tag}>`;
}

function buildSupplierXml(company: Company | null): string {
  const taxpayerId = normalizeTaxNumber(company?.taxNumber) ?? "00000000";
  const name = company?.name?.trim() || "InvoHub felhasználó";
  const addressXml =
    company?.city && company?.zipCode
      ? `<supplierAddress>
        <simpleAddress>
          <base:countryCode>${escapeXml(company?.country || "HU")}</base:countryCode>
          <base:postalCode>${escapeXml(company.zipCode)}</base:postalCode>
          <base:city>${escapeXml(company.city)}</base:city>
        </simpleAddress>
      </supplierAddress>`
      : "";
  const bankAccountXml = company?.bankAccount
    ? `<supplierBankAccountNumber>${escapeXml(company.bankAccount)}</supplierBankAccountNumber>`
    : "";

  return `<supplierInfo>
      ${taxNumberBlockXml("supplierTaxNumber", taxpayerId)}
      <supplierName>${escapeXml(name)}</supplierName>
      ${addressXml}
      ${bankAccountXml}
    </supplierInfo>`;
}

function buildCustomerXml(invoice: Invoice): string {
  if (!invoice.clientName?.trim()) return "";
  const taxpayerId = normalizeTaxNumber(invoice.clientTaxNumber);
  const status = taxpayerId ? "DOMESTIC" : "PRIVATE_PERSON";
  const vatDataXml = taxpayerId
    ? `<customerVatData>
        ${taxNumberBlockXml("customerTaxNumber", taxpayerId)}
      </customerVatData>`
    : "";

  return `<customerInfo>
      <customerVatStatus>${status}</customerVatStatus>
      ${vatDataXml}
      <customerName>${escapeXml(invoice.clientName)}</customerName>
    </customerInfo>`;
}

function buildLineXml(line: InvoiceLineItem, lineNumber: number, extra: NavLineItemExtra): string {
  const net = lineItemNetTotal(line);
  const isExempt = !!extra.vatExemption;
  const vat = isExempt ? 0 : lineItemVatAmount(line);
  const gross = isExempt ? net : lineItemGrossTotal(line);

  const vatRateXml = isExempt
    ? `<vatExemption>
              <case>${escapeXml(extra.vatExemption!.case)}</case>
              <reason>${escapeXml(extra.vatExemption!.reason)}</reason>
            </vatExemption>`
    : `<vatPercentage>${formatRate(line.vatRate)}</vatPercentage>`;

  return `<line>
        <lineNumber>${lineNumber}</lineNumber>
        <lineExpressionIndicator>true</lineExpressionIndicator>
        <lineNatureIndicator>SERVICE</lineNatureIndicator>
        <lineDescription>${escapeXml(line.description || "Tétel")}</lineDescription>
        <quantity>${formatAmount(line.quantity)}</quantity>
        <unitOfMeasure>OWN</unitOfMeasure>
        <unitOfMeasureOwn>db</unitOfMeasureOwn>
        <unitPrice>${formatAmount(line.unitPrice)}</unitPrice>
        <lineAmountsNormal>
          <lineNetAmountData>
            <lineNetAmount>${formatAmount(net)}</lineNetAmount>
            <lineNetAmountHUF>${formatAmount(net)}</lineNetAmountHUF>
          </lineNetAmountData>
          <lineVatRate>
            ${vatRateXml}
          </lineVatRate>
          <lineVatData>
            <lineVatAmount>${formatAmount(vat)}</lineVatAmount>
            <lineVatAmountHUF>${formatAmount(vat)}</lineVatAmountHUF>
          </lineVatData>
          <lineGrossAmountData>
            <lineGrossAmountNormal>${formatAmount(gross)}</lineGrossAmountNormal>
            <lineGrossAmountNormalHUF>${formatAmount(gross)}</lineGrossAmountNormalHUF>
          </lineGrossAmountData>
        </lineAmountsNormal>
      </line>`;
}

type VatRateGroupKey = string; // "pct:27" | "exempt:AAM"

function vatRateGroupKey(line: InvoiceLineItem, extra: NavLineItemExtra): VatRateGroupKey {
  return extra.vatExemption ? `exempt:${extra.vatExemption.case}` : `pct:${line.vatRate}`;
}

function buildSummaryXml(
  lineItems: InvoiceLineItem[],
  lineExtras: Record<string, NavLineItemExtra>
): string {
  const groups = new Map<
    VatRateGroupKey,
    { extra: NavLineItemExtra; vatRate: number; net: number; vat: number; gross: number }
  >();

  for (const line of lineItems) {
    const extra = lineExtras[line.id] ?? {};
    const key = vatRateGroupKey(line, extra);
    const net = lineItemNetTotal(line);
    const vat = extra.vatExemption ? 0 : lineItemVatAmount(line);
    const gross = extra.vatExemption ? net : lineItemGrossTotal(line);
    const existing = groups.get(key);
    if (existing) {
      existing.net += net;
      existing.vat += vat;
      existing.gross += gross;
    } else {
      groups.set(key, { extra, vatRate: line.vatRate, net, vat, gross });
    }
  }

  const byRateXml = Array.from(groups.values())
    .map((group) => {
      const vatRateXml = group.extra.vatExemption
        ? `<vatExemption>
              <case>${escapeXml(group.extra.vatExemption.case)}</case>
              <reason>${escapeXml(group.extra.vatExemption.reason)}</reason>
            </vatExemption>`
        : `<vatPercentage>${formatRate(group.vatRate)}</vatPercentage>`;
      return `<summaryByVatRate>
          <vatRate>
            ${vatRateXml}
          </vatRate>
          <vatRateNetData>
            <vatRateNetAmount>${formatAmount(group.net)}</vatRateNetAmount>
            <vatRateNetAmountHUF>${formatAmount(group.net)}</vatRateNetAmountHUF>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>${formatAmount(group.vat)}</vatRateVatAmount>
            <vatRateVatAmountHUF>${formatAmount(group.vat)}</vatRateVatAmountHUF>
          </vatRateVatData>
          <vatRateGrossData>
            <vatRateGrossAmount>${formatAmount(group.gross)}</vatRateGrossAmount>
            <vatRateGrossAmountHUF>${formatAmount(group.gross)}</vatRateGrossAmountHUF>
          </vatRateGrossData>
        </summaryByVatRate>`;
    })
    .join("\n      ");

  // Not calculateInvoiceTotals(): that helper doesn't know about vatExemption
  // (a per-line NAV override), so totals are recomputed here honoring it.
  const netTotal = lineItems.reduce((sum, line) => sum + lineItemNetTotal(line), 0);
  const vatTotal = lineItems.reduce((sum, line) => {
    const extra = lineExtras[line.id] ?? {};
    return sum + (extra.vatExemption ? 0 : lineItemVatAmount(line));
  }, 0);
  const grossTotal = netTotal + vatTotal;

  return `<invoiceSummary>
      <summaryNormal>
        ${byRateXml}
        <invoiceNetAmount>${formatAmount(netTotal)}</invoiceNetAmount>
        <invoiceNetAmountHUF>${formatAmount(netTotal)}</invoiceNetAmountHUF>
        <invoiceVatAmount>${formatAmount(vatTotal)}</invoiceVatAmount>
        <invoiceVatAmountHUF>${formatAmount(vatTotal)}</invoiceVatAmountHUF>
      </summaryNormal>
      <summaryGrossData>
        <invoiceGrossAmount>${formatAmount(grossTotal)}</invoiceGrossAmount>
        <invoiceGrossAmountHUF>${formatAmount(grossTotal)}</invoiceGrossAmountHUF>
      </summaryGrossData>
    </invoiceSummary>`;
}

/**
 * Builds the InvoiceData XML for a CREATE (or MODIFY/STORNO, same shape)
 * operation. `lineExtras` maps InvoiceLineItem.id -> per-line NAV overrides
 * (currently just vatExemption) for callers that have them; omit for a
 * normal VAT-rated invoice.
 */
export function buildNavInvoiceXml(
  invoice: Invoice & NavInvoiceExtra,
  company: Company | null,
  lineExtras: Record<string, NavLineItemExtra> = {}
): string {
  const deliveryDate = invoice.invoiceDeliveryDate ?? invoice.issueDate;
  const appearance = invoice.invoiceAppearance ?? "PAPER";

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="${NS_DATA}" xmlns:base="${NS_BASE}">
  <invoiceNumber>${escapeXml(invoice.invoiceNumber)}</invoiceNumber>
  <invoiceIssueDate>${escapeXml(invoice.issueDate)}</invoiceIssueDate>
  <completenessIndicator>false</completenessIndicator>
  <invoiceMain>
    <invoice>
      <invoiceHead>
        ${buildSupplierXml(company)}
        ${buildCustomerXml(invoice)}
        <invoiceDetail>
          <invoiceCategory>NORMAL</invoiceCategory>
          <invoiceDeliveryDate>${escapeXml(deliveryDate)}</invoiceDeliveryDate>
          <currencyCode>${escapeXml(invoice.currency)}</currencyCode>
          <exchangeRate>1</exchangeRate>
          <paymentDate>${escapeXml(invoice.dueDate)}</paymentDate>
          <invoiceAppearance>${appearance}</invoiceAppearance>
        </invoiceDetail>
      </invoiceHead>
      <invoiceLines>
        <mergedItemIndicator>false</mergedItemIndicator>
        ${invoice.lineItems
          .map((line, index) => buildLineXml(line, index + 1, lineExtras[line.id] ?? {}))
          .join("\n        ")}
      </invoiceLines>
      ${buildSummaryXml(invoice.lineItems, lineExtras)}
    </invoice>
  </invoiceMain>
</InvoiceData>`;
}
