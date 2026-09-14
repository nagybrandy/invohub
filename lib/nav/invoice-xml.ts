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
//  - Per-line VAT treatment (vatPercentage/vatExemption) is now derived
//    automatically from InvoiceLineItem.vatCategory (see
//    resolveLineNavTreatment) for AAM/TAM/KBAET/AHK (verified NAV
//    vatExemption case codes) plus a best-effort FAD -> vatDomesticReverseCharge
//    and ATK -> vatOutOfScope mapping that has NOT been cross-checked against
//    the real XSD the way vatExemption/vatPercentage were — verify before a
//    real FAD/ATK submission.
//  - Storno/helyesbítő (documentType "storno"/"modify") now emit the
//    <invoiceReference> block (originalInvoiceNumber/modifyWithoutMaster/
//    modificationIndex, in that order) as the first child of <invoice>,
//    before <invoiceHead> — verified directly against the real schema
//    (InvoiceReferenceType in nav-gov-hu/Online-Invoice's invoiceData.xsd,
//    fetched 2026-09-14; not just inferred). submit-outgoing.ts resolves
//    the referenced invoice's number and whether it was ever actually
//    reported to NAV (-> modifyWithoutMaster) before calling this.
//    `invoiceCategory` stays "NORMAL" for every document type — that field
//    is unrelated (simplified/aggregate vs. normal invoice shape), not a
//    create/modify/storno marker; confirmed against invoiceBase.xsd's
//    InvoiceCategoryType, which has no MODIFY/STORNO value.
//  - invoice.paymentMethod/paidAt/paidAmount (lib/invoices/types.ts) are not
//    yet reflected in the XML — same reason (schema placement not verified).
import { lineItemGrossTotal, lineItemNetTotal, lineItemVatAmount } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
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

/** NAV case code + free-text reason for a line that's outside the scope of VAT (e.g. "ATK"). */
export type NavOutOfScope = { case: string; reason: string };

/**
 * Extra, schema-shaped fields another track may add to Invoice/
 * InvoiceLineItem later (vatCategory/AAM work). Optional everywhere and
 * defaulted gracefully when absent — a plain Invoice/InvoiceLineItem from
 * today's types still builds valid, schema-shaped XML.
 *
 * When omitted, a line's treatment is now derived automatically from
 * InvoiceLineItem.vatCategory (see resolveLineNavTreatment) — passing
 * `vatExemption`/`reverseCharge`/`vatOutOfScope` explicitly still overrides
 * that derivation, for callers that need to.
 */
export type NavLineItemExtra = {
  vatExemption?: NavVatExemption;
  /** Domestic reverse charge ("fordított adózás" — NAV's vatCategory "FAD"). */
  reverseCharge?: boolean;
  vatOutOfScope?: NavOutOfScope;
};
/**
 * Modification/cancellation reference (InvoiceReferenceType in the real
 * XSD). Required for MODIFY/STORNO manageInvoice operations to validate;
 * omit for CREATE.
 */
export type NavInvoiceReference = {
  /** The referenced invoice's NAV-facing invoiceNumber (not InvoHub's internal id). */
  originalInvoiceNumber: string;
  /** True if the original invoice was never (and will never be) reported to NAV. */
  modifyWithoutMaster: boolean;
  /** 1-based count of corrections/stornos issued against the same original invoice. */
  modificationIndex: number;
};

export type NavInvoiceExtra = {
  vatExemption?: NavVatExemption;
  invoiceAppearance?: "PAPER" | "ELECTRONIC";
  invoiceDeliveryDate?: string;
  invoiceReference?: NavInvoiceReference;
};

/**
 * Maps an InvoHub VatCategory to the NAV XML element it needs (verified
 * element names: vatPercentage/vatExemption; the "FAD"->reverse-charge and
 * "ATK"->out-of-scope mappings below are a best-effort translation of the
 * invoicing track's category codes and have NOT been independently
 * cross-checked against the real NAV XSD the way vatExemption/vatPercentage
 * were (see docs/nav-test-setup.md openIssues) — verify before relying on
 * FAD/ATK invoices passing real NAV validation.
 */
function resolveLineNavTreatment(line: InvoiceLineItem, explicit: NavLineItemExtra): NavLineItemExtra {
  if (explicit.vatExemption || explicit.reverseCharge || explicit.vatOutOfScope) return explicit;

  const category = line.vatCategory;
  if (!category || category === "normal") return {};

  const reason = resolveVatExemptionReason(category, line.vatExemptionReason) ?? category;
  if (category === "FAD") return { reverseCharge: true };
  if (category === "ATK") return { vatOutOfScope: { case: category, reason } };
  return { vatExemption: { case: category, reason } };
}

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

/** Renders the shared vatPercentage/vatExemption/vatOutOfScope/reverse-charge choice group. */
function vatTreatmentXml(treatment: NavLineItemExtra, vatRatePercent: number): string {
  if (treatment.vatExemption) {
    return `<vatExemption>
              <case>${escapeXml(treatment.vatExemption.case)}</case>
              <reason>${escapeXml(treatment.vatExemption.reason)}</reason>
            </vatExemption>`;
  }
  if (treatment.vatOutOfScope) {
    return `<vatOutOfScope>
              <case>${escapeXml(treatment.vatOutOfScope.case)}</case>
              <reason>${escapeXml(treatment.vatOutOfScope.reason)}</reason>
            </vatOutOfScope>`;
  }
  if (treatment.reverseCharge) {
    return `<vatDomesticReverseCharge>true</vatDomesticReverseCharge>`;
  }
  return `<vatPercentage>${formatRate(vatRatePercent)}</vatPercentage>`;
}

function isZeroVatTreatment(treatment: NavLineItemExtra): boolean {
  return !!(treatment.vatExemption || treatment.vatOutOfScope || treatment.reverseCharge);
}

function buildLineXml(line: InvoiceLineItem, lineNumber: number, extra: NavLineItemExtra): string {
  const net = lineItemNetTotal(line);
  const treatment = resolveLineNavTreatment(line, extra);
  const isExempt = isZeroVatTreatment(treatment);
  const vat = isExempt ? 0 : lineItemVatAmount(line);
  const gross = isExempt ? net : lineItemGrossTotal(line);

  const vatRateXml = vatTreatmentXml(treatment, line.vatRate);

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

type VatRateGroupKey = string; // "pct:27" | "exempt:AAM" | "outofscope:ATK" | "reverse:FAD"

function vatRateGroupKey(line: InvoiceLineItem, treatment: NavLineItemExtra): VatRateGroupKey {
  if (treatment.vatExemption) return `exempt:${treatment.vatExemption.case}`;
  if (treatment.vatOutOfScope) return `outofscope:${treatment.vatOutOfScope.case}`;
  if (treatment.reverseCharge) return `reverse:FAD`;
  return `pct:${line.vatRate}`;
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
    const treatment = resolveLineNavTreatment(line, lineExtras[line.id] ?? {});
    const key = vatRateGroupKey(line, treatment);
    const net = lineItemNetTotal(line);
    const isExempt = isZeroVatTreatment(treatment);
    const vat = isExempt ? 0 : lineItemVatAmount(line);
    const gross = isExempt ? net : lineItemGrossTotal(line);
    const existing = groups.get(key);
    if (existing) {
      existing.net += net;
      existing.vat += vat;
      existing.gross += gross;
    } else {
      groups.set(key, { extra: treatment, vatRate: line.vatRate, net, vat, gross });
    }
  }

  const byRateXml = Array.from(groups.values())
    .map((group) => {
      const vatRateXml = vatTreatmentXml(group.extra, group.vatRate);
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

  // Not calculateInvoiceTotals(): that helper doesn't know about per-line NAV
  // overrides, so totals are recomputed here honoring the resolved treatment.
  const netTotal = lineItems.reduce((sum, line) => sum + lineItemNetTotal(line), 0);
  const vatTotal = lineItems.reduce((sum, line) => {
    const treatment = resolveLineNavTreatment(line, lineExtras[line.id] ?? {});
    return sum + (isZeroVatTreatment(treatment) ? 0 : lineItemVatAmount(line));
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
  const reference = invoice.invoiceReference;
  // Sequence order per InvoiceReferenceType: originalInvoiceNumber,
  // modifyWithoutMaster, modificationIndex.
  const referenceXml = reference
    ? `<invoiceReference>
        <originalInvoiceNumber>${escapeXml(reference.originalInvoiceNumber)}</originalInvoiceNumber>
        <modifyWithoutMaster>${reference.modifyWithoutMaster}</modifyWithoutMaster>
        <modificationIndex>${reference.modificationIndex}</modificationIndex>
      </invoiceReference>
      `
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoiceData xmlns="${NS_DATA}" xmlns:base="${NS_BASE}">
  <invoiceNumber>${escapeXml(invoice.invoiceNumber)}</invoiceNumber>
  <invoiceIssueDate>${escapeXml(invoice.issueDate)}</invoiceIssueDate>
  <completenessIndicator>false</completenessIndicator>
  <invoiceMain>
    <invoice>
      ${referenceXml}<invoiceHead>
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
