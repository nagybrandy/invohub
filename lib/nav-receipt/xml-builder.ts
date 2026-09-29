// lib/nav-receipt/xml-builder.ts
// Builds NAV eRECEIPT request XML against the published XSD
// (xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.1.xsd) — see plan §1.2.
// Two request shapes, two requestId generators (do not mix them up):
//   - AuthTokenRequest: "legacy" shape, signed with requestSignature.
//   - CreateReceiptRequest: "business" shape, authorized via Bearer token
//     (see auth.ts / report.ts) — no signature inside the body itself.
import { sha512UpperHex } from "@/lib/nav/crypto";
import { escapeXml } from "@/lib/nav/xml-utils";

import { buildReceiptRequestSignature, newAuthRequestId, newServiceRequestId } from "./signature";
import { toTaxpayerId } from "./taxpayer";
import type { DailyReceiptReport, NavReceiptCredentials } from "./types";

const RECEIPT_NAMESPACE = "http://schemas.nav.gov.hu/NTCA/1.0/receipt";
const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";

export function buildAuthTokenXml(credentials: NavReceiptCredentials): string {
  const requestId = newAuthRequestId();
  const timestamp = new Date();
  const passwordHash = sha512UpperHex(credentials.technicalPassword);
  const requestSignature = buildReceiptRequestSignature({
    requestId,
    timestamp,
    signKey: credentials.signingKey,
  });
  const taxNumber = toTaxpayerId(credentials.taxNumber);

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuthTokenRequest xmlns="${RECEIPT_NAMESPACE}">
  <context>
    <requestId>${escapeXml(requestId)}</requestId>
    <timestamp>${timestamp.toISOString()}</timestamp>
  </context>
  <auth>
    <login>${escapeXml(credentials.technicalUser)}</login>
    <passwordHash cryptoType="SHA-512">${passwordHash}</passwordHash>
    <taxNumber>${escapeXml(taxNumber)}</taxNumber>
    <requestSignature cryptoType="SHA3-512">${requestSignature}</requestSignature>
  </auth>
  <requestVersion>1.0</requestVersion>
  <headerVersion>1.0</headerVersion>
</AuthTokenRequest>`;
}

export function buildCreateReceiptXml(report: DailyReceiptReport): string {
  // Non-HUF receipts are never reported: InvoHub stores no exchange rate,
  // and exchangeRate is a required (nillable) field — inventing a rate
  // would put a wrong figure into a mandatory NAV filing (plan §1.3).
  if (report.currency !== "HUF") {
    throw new Error(
      `buildCreateReceiptXml only builds HUF reports — got currency "${report.currency}". ` +
        "Non-HUF receipt days must be refused, not guessed (plan §1.3)."
    );
  }

  const requestId = newServiceRequestId();
  const timestamp = new Date();
  const taxPayerId = toTaxpayerId(report.taxPayerId);

  const vatCategoryXml = report.vatCategoryItems
    .map(
      (item) => `      <vatCategory>
        <vat>${escapeXml(item.vat)}</vat>
        <saleDocument>${item.saleDocument.toFixed(2)}</saleDocument>
        <modifyingDocument>${item.modifyingDocument.toFixed(2)}</modifyingDocument>
      </vatCategory>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreateReceiptRequest xmlns="${RECEIPT_NAMESPACE}" xmlns:xsi="${XSI_NAMESPACE}">
  <context>
    <requestId>${escapeXml(requestId)}</requestId>
    <timestamp>${timestamp.toISOString()}</timestamp>
  </context>
  <taxPayerId>${escapeXml(taxPayerId)}</taxPayerId>
  <issuingSoftware>
    <name>${escapeXml(report.issuingSoftwareName)}</name>
  </issuingSoftware>
  <applicableDate>${escapeXml(report.applicableDate)}</applicableDate>
  <serialNumber>${escapeXml(report.serialNumber)}</serialNumber>
  <currency>${escapeXml(report.currency)}</currency>
  <exchangeRate xsi:nil="true"/>
  <vatCategoryItems>
${vatCategoryXml}
  </vatCategoryItems>
  <total>${report.total.toFixed(2)}</total>
  <numberOfSaleDocument>${report.numberOfSaleDocument}</numberOfSaleDocument>
  <numberOfModifyingDocument>${report.numberOfModifyingDocument}</numberOfModifyingDocument>
</CreateReceiptRequest>`;
}
