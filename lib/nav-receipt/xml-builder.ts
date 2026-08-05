// lib/nav-receipt/xml-builder.ts
import { createHash, randomUUID } from "crypto";

import type { DailyReceiptReport, NavReceiptCredentials } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sha512(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex").toUpperCase();
}

function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildHeaderXml(requestId: string): string {
  return `<common:header>
      <common:requestId>${requestId}</common:requestId>
      <common:timestamp>${utcTimestamp()}</common:timestamp>
    </common:header>`;
}

function buildUserXml(credentials: NavReceiptCredentials): string {
  const passwordHash = sha512(credentials.technicalPassword);
  return `<common:user>
      <common:login>${escapeXml(credentials.technicalUser)}</common:login>
      <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
      <common:taxNumber>${escapeXml(credentials.taxNumber)}</common:taxNumber>
    </common:user>`;
}

export function buildAuthenticateXml(credentials: NavReceiptCredentials): string {
  const requestId = randomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/receipt/1.0/api"
  xmlns:common="http://schemas.nav.gov.hu/receipt/1.0/common">
  ${buildHeaderXml(requestId)}
  ${buildUserXml(credentials)}
</TokenExchangeRequest>`;
}

export function buildSoftwareRegistrationXml(
  credentials: NavReceiptCredentials,
  softwareName: string
): string {
  const requestId = randomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<SoftwareRegistrationRequest xmlns="http://schemas.nav.gov.hu/receipt/1.0/api"
  xmlns:common="http://schemas.nav.gov.hu/receipt/1.0/common">
  ${buildHeaderXml(requestId)}
  ${buildUserXml(credentials)}
  <software>
    <softwareName>${escapeXml(softwareName)}</softwareName>
    <softwareVersion>1.0</softwareVersion>
    <softwareDevName>InvoHub</softwareDevName>
    <softwareDevTaxNumber>${escapeXml(credentials.taxNumber)}</softwareDevTaxNumber>
  </software>
</SoftwareRegistrationRequest>`;
}

export function buildReceiptDataReportXml(report: DailyReceiptReport): string {
  const requestId = randomUUID();
  const vatLines = report.vatAggregations
    .map(
      (v) => `      <vatAggregation>
        <vatRateCode>${escapeXml(v.vatRateCode)}</vatRateCode>
        <vatRate>${v.vatRate}</vatRate>
        <netAmount>${v.netAmount}</netAmount>
        <vatAmount>${v.vatAmount}</vatAmount>
        <grossAmount>${v.grossAmount}</grossAmount>
        <receiptCount>${v.receiptCount}</receiptCount>
      </vatAggregation>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ReceiptDataReportRequest xmlns="http://schemas.nav.gov.hu/receipt/1.0/api"
  xmlns:common="http://schemas.nav.gov.hu/receipt/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${utcTimestamp()}</common:timestamp>
  </common:header>
  <receiptDataReport>
    <taxNumber>${escapeXml(report.taxNumber)}</taxNumber>
    <softwareId>${escapeXml(report.softwareId)}</softwareId>
    <reportDate>${report.reportDate}</reportDate>
    <startReceiptNumber>${escapeXml(report.startReceiptNumber)}</startReceiptNumber>
    <endReceiptNumber>${escapeXml(report.endReceiptNumber)}</endReceiptNumber>
    <receiptCount>${report.receiptCount}</receiptCount>
    <cancelledCount>${report.cancelledCount}</cancelledCount>
    <vatAggregations>
${vatLines}
    </vatAggregations>
  </receiptDataReport>
</ReceiptDataReportRequest>`;
}
