// lib/nav/invoice-xml.ts
// Builds a NAV Online Számla v3.0 (OSA 3.0) InvoiceData XML document for a
// simple domestic invoice — one supplier, one customer, N lines, normal
// (non-modification) summary. Namespaces and element names/order follow the
// public schema and samples at https://github.com/nav-gov-hu/Online-Invoice
// (src/schemas/.../invoiceData.xsd, sample/Data sample/*.xml).
//
// Known simplifications (see docs/nav-test-setup.md openIssues):
//  - Only `simpleAddress` (countryCode/postalCode/city/additionalAddressDetail
//    — all four mandatory in SimpleAddressType) is emitted; the free-text
//    street goes into additionalAddressDetail. An incomplete address is
//    omitted entirely rather than emitted schema-invalid.
//  - customerInfo is derived by lib/nav/customer.ts (DOMESTIC / OTHER /
//    PRIVATE_PERSON — see that file). Callers pass the derived `customer`;
//    without one we fall back to the invoice's own name/tax-number snapshot.
//  - unitOfMeasure is mapped by lib/nav/unit-of-measure.ts (OWN only for
//    units NAV's enum lacks, e.g. m²).
//  - Modification documents (storno/helyesbítő) report every line as a new
//    line: lineModificationReference/lineOperation CREATE with
//    lineNumberReference = lineNumberReferenceBase + n (the caller passes the
//    number of lines already in the modification chain).
//  - Előlegszámla (documentType "advance") lines carry
//    advanceData/advanceIndicator=true.
//  - `exchangeRate` reflects the invoice's own manually-entered
//    `invoice.exchangeRate` (1 for HUF, always) — every `…HUF` element is
//    derived from it via lib/invoices/exchange-rate.ts. Two open tax/legal
//    questions this does NOT resolve (see the implementation plan's OQ-1/
//    OQ-2, docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md):
//    which date's rate governs (no MNB/ECB lookup, no rate-date column yet),
//    and whether the HUF VAT amount must round to whole forint rather than
//    keeping 2 decimals.
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
//  - invoice.paymentMethod now emits <paymentMethod> (verified element
//    position between <exchangeRate> and <paymentDate> in
//    InvoiceDetailType's xs:sequence; see lib/nav/invoice-fields.ts) and
//    <paymentDate> is invoice.dueDate — the fizetési határidő (deadline for
//    payment), which is what base:InvoiceDateType's paymentDate documents.
//    invoice.paidAt (the *actual* payment date) has no OSA 3.0 element to
//    go in and is deliberately NOT emitted — see
//    docs/plans/2026-09-15-nav-xml-payment-method-date.md §1 for the
//    XSD-verified reasoning. Do not "fix" paymentDate to read paidAt.
import { lineItemGrossTotal, lineItemNetTotal, lineItemVatAmount } from "@/lib/invoices/calculations";
import { formatExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import type { Company } from "@/lib/companies/service";
import { escapeXml } from "@/lib/nav/xml-utils";
import { toNavDate, toNavPaymentMethod } from "@/lib/nav/invoice-fields";
import { toIsoCountryCode } from "@/lib/nav/country-code";
import {
  deriveNavCustomer,
  parseHungarianTaxNumber,
  resolveNavBuyer,
  type NavCustomer,
  type NavSimpleAddress,
  type NavTaxNumber,
} from "@/lib/nav/customer";
import { navLineUnitOf, toNavUnitOfMeasure } from "@/lib/nav/unit-of-measure";

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
  /** Derived buyer (lib/nav/customer.ts). Falls back to the invoice's own name/tax number. */
  customer?: NavCustomer;
  /**
   * Modification documents only: how many lines the modification chain
   * (original + earlier storno/helyesbítő documents) already has — new lines
   * are reported as lineNumberReference base+1, base+2, …
   */
  lineNumberReferenceBase?: number;
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

function taxNumberBlockXml(tag: "supplierTaxNumber" | "customerTaxNumber", taxNumber: NavTaxNumber): string {
  const vatCodeXml = taxNumber.vatCode ? `\n          <base:vatCode>${escapeXml(taxNumber.vatCode)}</base:vatCode>` : "";
  const countyCodeXml = taxNumber.countyCode
    ? `\n          <base:countyCode>${escapeXml(taxNumber.countyCode)}</base:countyCode>`
    : "";
  return `<${tag}>
          <base:taxpayerId>${escapeXml(taxNumber.taxpayerId)}</base:taxpayerId>${vatCodeXml}${countyCodeXml}
        </${tag}>`;
}

function simpleAddressXml(tag: "supplierAddress" | "customerAddress", address: NavSimpleAddress): string {
  return `<${tag}>
        <simpleAddress>
          <base:countryCode>${escapeXml(address.countryCode)}</base:countryCode>
          <base:postalCode>${escapeXml(address.postalCode)}</base:postalCode>
          <base:city>${escapeXml(address.city)}</base:city>
          <base:additionalAddressDetail>${escapeXml(address.additionalAddressDetail)}</base:additionalAddressDetail>
        </simpleAddress>
      </${tag}>`;
}

function supplierAddress(company: Company | null): NavSimpleAddress | null {
  const postalCode = company?.zipCode?.trim();
  const city = company?.city?.trim();
  const additionalAddressDetail = company?.address?.trim();
  if (!postalCode || !city || !additionalAddressDetail) return null;
  const countryCode = toIsoCountryCode(company?.country) ?? "HU";
  return { countryCode, postalCode, city, additionalAddressDetail };
}

function buildSupplierXml(company: Company | null): string {
  // vatCode/countyCode come from the real adószám (an alanyi adómentes EV is
  // ÁFA-kód 1) — never hardcoded; a bare 8-digit törzsszám sends neither.
  const taxNumber = parseHungarianTaxNumber(company?.taxNumber) ?? { taxpayerId: "00000000" };
  const name = company?.name?.trim() || "InvoHub felhasználó";
  const address = supplierAddress(company);
  const addressXml = address ? simpleAddressXml("supplierAddress", address) : "";
  const bankAccountXml = company?.bankAccount
    ? `<supplierBankAccountNumber>${escapeXml(company.bankAccount)}</supplierBankAccountNumber>`
    : "";

  return `<supplierInfo>
      ${taxNumberBlockXml("supplierTaxNumber", taxNumber)}
      <supplierName>${escapeXml(name)}</supplierName>
      ${addressXml}
      ${bankAccountXml}
    </supplierInfo>`;
}

function buildCustomerXml(invoice: Invoice & NavInvoiceExtra): string {
  if (!invoice.clientName?.trim()) return "";
  const customer = invoice.customer ?? deriveNavCustomer(resolveNavBuyer(invoice, null));

  // PRIVATE_PERSON: NAV must not receive the natural person's tax data,
  // name or address — the status alone.
  if (customer.vatStatus === "PRIVATE_PERSON") {
    return `<customerInfo>
      <customerVatStatus>PRIVATE_PERSON</customerVatStatus>
    </customerInfo>`;
  }

  let vatDataXml = "";
  if (customer.vatStatus === "DOMESTIC") {
    vatDataXml = `<customerVatData>
        ${taxNumberBlockXml("customerTaxNumber", customer.taxNumber)}
      </customerVatData>`;
  } else if (customer.communityVatNumber) {
    vatDataXml = `<customerVatData>
        <communityVatNumber>${escapeXml(customer.communityVatNumber)}</communityVatNumber>
      </customerVatData>`;
  } else if (customer.thirdStateTaxId) {
    vatDataXml = `<customerVatData>
        <thirdStateTaxId>${escapeXml(customer.thirdStateTaxId)}</thirdStateTaxId>
      </customerVatData>`;
  }
  const addressXml = customer.address ? simpleAddressXml("customerAddress", customer.address) : "";

  return `<customerInfo>
      <customerVatStatus>${customer.vatStatus}</customerVatStatus>
      ${vatDataXml}
      <customerName>${escapeXml(customer.name || invoice.clientName)}</customerName>
      ${addressXml}
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

type LineContext = {
  /** Set for modification documents: lineNumberReference = base + lineNumber. */
  lineNumberReferenceBase?: number;
  advance: boolean;
};

function buildLineXml(
  line: InvoiceLineItem,
  lineNumber: number,
  extra: NavLineItemExtra,
  rate: number,
  context: LineContext
): string {
  const net = lineItemNetTotal(line);
  const treatment = resolveLineNavTreatment(line, extra);
  const isExempt = isZeroVatTreatment(treatment);
  const vat = isExempt ? 0 : lineItemVatAmount(line);
  const gross = isExempt ? net : lineItemGrossTotal(line);

  const vatRateXml = vatTreatmentXml(treatment, line.vatRate);

  // xs:sequence: lineNumber, lineModificationReference, referencesToOtherLines,
  // advanceData, productCodes, lineExpressionIndicator, …
  const modificationXml =
    context.lineNumberReferenceBase !== undefined
      ? `
        <lineModificationReference>
          <lineNumberReference>${context.lineNumberReferenceBase + lineNumber}</lineNumberReference>
          <lineOperation>CREATE</lineOperation>
        </lineModificationReference>`
      : "";
  const advanceXml = context.advance
    ? `
        <advanceData>
          <advanceIndicator>true</advanceIndicator>
        </advanceData>`
    : "";
  const unit = toNavUnitOfMeasure(navLineUnitOf(line));
  const unitOwnXml = unit.unitOfMeasureOwn
    ? `
        <unitOfMeasureOwn>${escapeXml(unit.unitOfMeasureOwn)}</unitOfMeasureOwn>`
    : "";

  return `<line>
        <lineNumber>${lineNumber}</lineNumber>${modificationXml}${advanceXml}
        <lineExpressionIndicator>true</lineExpressionIndicator>
        <lineNatureIndicator>SERVICE</lineNatureIndicator>
        <lineDescription>${escapeXml(line.description || "Tétel")}</lineDescription>
        <quantity>${formatAmount(line.quantity)}</quantity>
        <unitOfMeasure>${unit.unitOfMeasure}</unitOfMeasure>${unitOwnXml}
        <unitPrice>${formatAmount(line.unitPrice)}</unitPrice>
        <lineAmountsNormal>
          <lineNetAmountData>
            <lineNetAmount>${formatAmount(net)}</lineNetAmount>
            <lineNetAmountHUF>${formatAmount(toHufAmount(net, rate))}</lineNetAmountHUF>
          </lineNetAmountData>
          <lineVatRate>
            ${vatRateXml}
          </lineVatRate>
          <lineVatData>
            <lineVatAmount>${formatAmount(vat)}</lineVatAmount>
            <lineVatAmountHUF>${formatAmount(toHufAmount(vat, rate))}</lineVatAmountHUF>
          </lineVatData>
          <lineGrossAmountData>
            <lineGrossAmountNormal>${formatAmount(gross)}</lineGrossAmountNormal>
            <lineGrossAmountNormalHUF>${formatAmount(toHufAmount(gross, rate))}</lineGrossAmountNormalHUF>
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
  lineExtras: Record<string, NavLineItemExtra>,
  rate: number
): string {
  const groups = new Map<
    VatRateGroupKey,
    {
      extra: NavLineItemExtra;
      vatRate: number;
      net: number;
      vat: number;
      gross: number;
      netHuf: number;
      vatHuf: number;
      grossHuf: number;
    }
  >();

  for (const line of lineItems) {
    const treatment = resolveLineNavTreatment(line, lineExtras[line.id] ?? {});
    const key = vatRateGroupKey(line, treatment);
    const net = lineItemNetTotal(line);
    const isExempt = isZeroVatTreatment(treatment);
    const vat = isExempt ? 0 : lineItemVatAmount(line);
    const gross = isExempt ? net : lineItemGrossTotal(line);
    // Convert per line, then sum the already-rounded HUF values — never
    // convert an already-summed document-currency total. This is what keeps
    // NAV's cross-sum validation (summaryByVatRate / invoice totals against
    // the per-line amounts) consistent; see plan §2(b).
    const netHuf = toHufAmount(net, rate);
    const vatHuf = toHufAmount(vat, rate);
    const grossHuf = toHufAmount(gross, rate);
    const existing = groups.get(key);
    if (existing) {
      existing.net += net;
      existing.vat += vat;
      existing.gross += gross;
      existing.netHuf += netHuf;
      existing.vatHuf += vatHuf;
      existing.grossHuf += grossHuf;
    } else {
      groups.set(key, { extra: treatment, vatRate: line.vatRate, net, vat, gross, netHuf, vatHuf, grossHuf });
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
            <vatRateNetAmountHUF>${formatAmount(group.netHuf)}</vatRateNetAmountHUF>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>${formatAmount(group.vat)}</vatRateVatAmount>
            <vatRateVatAmountHUF>${formatAmount(group.vatHuf)}</vatRateVatAmountHUF>
          </vatRateVatData>
          <vatRateGrossData>
            <vatRateGrossAmount>${formatAmount(group.gross)}</vatRateGrossAmount>
            <vatRateGrossAmountHUF>${formatAmount(group.grossHuf)}</vatRateGrossAmountHUF>
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

  // Same per-line-then-sum rule for the invoice-level HUF totals — equal to
  // the sum of the group HUF sums above, computed independently here so a
  // future refactor of either block still has to keep both honest.
  const netTotalHuf = lineItems.reduce((sum, line) => sum + toHufAmount(lineItemNetTotal(line), rate), 0);
  const vatTotalHuf = lineItems.reduce((sum, line) => {
    const treatment = resolveLineNavTreatment(line, lineExtras[line.id] ?? {});
    const vat = isZeroVatTreatment(treatment) ? 0 : lineItemVatAmount(line);
    return sum + toHufAmount(vat, rate);
  }, 0);
  const grossTotalHuf = netTotalHuf + vatTotalHuf;

  return `<invoiceSummary>
      <summaryNormal>
        ${byRateXml}
        <invoiceNetAmount>${formatAmount(netTotal)}</invoiceNetAmount>
        <invoiceNetAmountHUF>${formatAmount(netTotalHuf)}</invoiceNetAmountHUF>
        <invoiceVatAmount>${formatAmount(vatTotal)}</invoiceVatAmount>
        <invoiceVatAmountHUF>${formatAmount(vatTotalHuf)}</invoiceVatAmountHUF>
      </summaryNormal>
      <summaryGrossData>
        <invoiceGrossAmount>${formatAmount(grossTotal)}</invoiceGrossAmount>
        <invoiceGrossAmountHUF>${formatAmount(grossTotalHuf)}</invoiceGrossAmountHUF>
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
  // Refuse, don't guess: a non-HUF invoice with no usable HUF rate never
  // gets a NAV report with a false (or hardcoded-1) HUF VAT base. This
  // propagates to submitOutgoingInvoiceToNav's caller uncaught, the same way
  // a missing invoiceReference already does — no navSubmission row is
  // written for a report that was never valid.
  const rateResolution = resolveExchangeRate(invoice);
  if (!rateResolution.ok) {
    throw new Error(
      `Cannot build NAV invoice XML for ${invoice.invoiceNumber || invoice.id}: the invoice's HUF exchange rate is missing.`
    );
  }
  const rate = rateResolution.rate;

  // Precedence: an explicit NavInvoiceExtra override wins, then the real
  // teljesítés dátuma column (fulfillmentDate), then issueDate as the last
  // resort — this element is mandatory and must never be empty (AC5).
  const rawDeliveryDate =
    invoice.invoiceDeliveryDate ?? invoice.fulfillmentDate ?? invoice.issueDate;
  // Mandatory elements (minOccurs unset) — never omitted. Normalize to
  // date-only per InvoiceDateType; fall back to the raw escaped string when
  // toNavDate can't parse it, so no currently-working invoice regresses.
  const issueDate = toNavDate(invoice.issueDate) ?? invoice.issueDate;
  const deliveryDate = toNavDate(rawDeliveryDate) ?? rawDeliveryDate;
  const appearance = invoice.invoiceAppearance ?? "PAPER";
  const reference = invoice.invoiceReference;

  const navPaymentMethod = toNavPaymentMethod(invoice.paymentMethod);
  const paymentMethodXml = navPaymentMethod
    ? `<paymentMethod>${navPaymentMethod}</paymentMethod>\n          `
    : "";
  // paymentDate is the fizetési határidő (due date), optional — omit rather
  // than emit an invalid/empty element when dueDate can't be normalized.
  const navPaymentDate = toNavDate(invoice.dueDate);
  const paymentDateXml = navPaymentDate
    ? `<paymentDate>${navPaymentDate}</paymentDate>\n          `
    : "";
  // Sequence order per InvoiceReferenceType: originalInvoiceNumber,
  // modifyWithoutMaster, modificationIndex.
  const lineContext: LineContext = {
    lineNumberReferenceBase: reference ? (invoice.lineNumberReferenceBase ?? 0) : undefined,
    advance: invoice.documentType === "advance",
  };
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
  <invoiceIssueDate>${escapeXml(issueDate)}</invoiceIssueDate>
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
          <exchangeRate>${formatExchangeRate(rate)}</exchangeRate>
          ${paymentMethodXml}${paymentDateXml}<invoiceAppearance>${appearance}</invoiceAppearance>
        </invoiceDetail>
      </invoiceHead>
      <invoiceLines>
        <mergedItemIndicator>false</mergedItemIndicator>
        ${invoice.lineItems
          .map((line, index) => buildLineXml(line, index + 1, lineExtras[line.id] ?? {}, rate, lineContext))
          .join("\n        ")}
      </invoiceLines>
      ${buildSummaryXml(invoice.lineItems, lineExtras, rate)}
    </invoice>
  </invoiceMain>
</InvoiceData>`;
}
