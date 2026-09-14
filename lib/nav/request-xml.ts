// lib/nav/request-xml.ts
// Builds the common header/user/software block and the four NAV OSA 3.0
// request bodies (tokenExchange, manageInvoice, queryTransactionStatus,
// queryTaxpayer). Element names/order follow the public samples in
// https://github.com/nav-gov-hu/Online-Invoice (sample/API sample/*.xml).
import {
  buildPasswordHash,
  buildRequestSignature,
  navIsoTimestamp,
  type ManageInvoiceSignatureOperation,
} from "@/lib/nav/crypto";
import type { NavRealCredentials } from "@/lib/nav/resolve-credentials";
import type { NavInvoiceOperationInput } from "@/lib/nav/types";
import { escapeXml } from "@/lib/nav/xml-utils";

export const NAV_NS_API = "http://schemas.nav.gov.hu/OSA/3.0/api";
export const NAV_NS_COMMON = "http://schemas.nav.gov.hu/NTCA/1.0/common";

export type NavSoftwareInfo = {
  softwareId: string;
  softwareName: string;
  softwareOperation: "LOCAL_SOFTWARE" | "ONLINE_SERVICE";
  softwareMainVersion: string;
  softwareDevName: string;
  softwareDevContact: string;
  softwareDevCountryCode: string;
  softwareDevTaxNumber?: string;
};

/** Reads the InvoHub software identity from env (NAV_SOFTWARE_ID must be a NAV-registered, 18-char id). */
export function getNavSoftwareInfo(): NavSoftwareInfo {
  return {
    softwareId: process.env.NAV_SOFTWARE_ID?.trim() ?? "",
    softwareName: "InvoHub",
    softwareOperation: "ONLINE_SERVICE",
    softwareMainVersion: process.env.NAV_SOFTWARE_VERSION?.trim() || "1.0.0",
    softwareDevName: process.env.NAV_SOFTWARE_DEV_NAME?.trim() || "InvoHub",
    softwareDevContact: process.env.NAV_SOFTWARE_DEV_CONTACT?.trim() || "tech@invohub.hu",
    softwareDevCountryCode: "HU",
    softwareDevTaxNumber: process.env.NAV_SOFTWARE_DEV_TAX_NUMBER?.trim() || undefined,
  };
}

export function generateNavRequestId(): string {
  // NAV requires 1-30 alphanumeric chars, unique per technical user per day.
  return `RID${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()}`;
}

function buildHeaderXml(requestId: string, timestamp: Date): string {
  return `  <common:header>
    <common:requestId>${escapeXml(requestId)}</common:requestId>
    <common:timestamp>${navIsoTimestamp(timestamp)}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>`;
}

function buildUserXml(
  credentials: NavRealCredentials,
  requestId: string,
  timestamp: Date,
  invoiceOperations?: ManageInvoiceSignatureOperation[]
): string {
  const passwordHash = buildPasswordHash(credentials.password);
  const requestSignature = buildRequestSignature({
    requestId,
    timestamp,
    signKey: credentials.signKey,
    invoiceOperations,
  });
  return `  <common:user>
    <common:login>${escapeXml(credentials.login)}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${escapeXml(credentials.taxNumber)}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>`;
}

function buildSoftwareXml(info: NavSoftwareInfo): string {
  return `  <software>
    <softwareId>${escapeXml(info.softwareId)}</softwareId>
    <softwareName>${escapeXml(info.softwareName)}</softwareName>
    <softwareOperation>${info.softwareOperation}</softwareOperation>
    <softwareMainVersion>${escapeXml(info.softwareMainVersion)}</softwareMainVersion>
    <softwareDevName>${escapeXml(info.softwareDevName)}</softwareDevName>
    <softwareDevContact>${escapeXml(info.softwareDevContact)}</softwareDevContact>
    <softwareDevCountryCode>${escapeXml(info.softwareDevCountryCode)}</softwareDevCountryCode>${
    info.softwareDevTaxNumber
      ? `\n    <softwareDevTaxNumber>${escapeXml(info.softwareDevTaxNumber)}</softwareDevTaxNumber>`
      : ""
  }
  </software>`;
}

export function buildTokenExchangeRequestXml(
  credentials: NavRealCredentials,
  requestId: string,
  timestamp: Date,
  software: NavSoftwareInfo
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns:common="${NAV_NS_COMMON}" xmlns="${NAV_NS_API}">
${buildHeaderXml(requestId, timestamp)}
${buildUserXml(credentials, requestId, timestamp)}
${buildSoftwareXml(software)}
</TokenExchangeRequest>`;
}

export function buildQueryTaxpayerRequestXml(
  credentials: NavRealCredentials,
  requestId: string,
  timestamp: Date,
  software: NavSoftwareInfo,
  taxNumber: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryTaxpayerRequest xmlns:common="${NAV_NS_COMMON}" xmlns="${NAV_NS_API}">
${buildHeaderXml(requestId, timestamp)}
${buildUserXml(credentials, requestId, timestamp)}
${buildSoftwareXml(software)}
  <taxNumber>${escapeXml(taxNumber)}</taxNumber>
</QueryTaxpayerRequest>`;
}

export function buildQueryTransactionStatusRequestXml(
  credentials: NavRealCredentials,
  requestId: string,
  timestamp: Date,
  software: NavSoftwareInfo,
  transactionId: string,
  returnOriginalRequest = false
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryTransactionStatusRequest xmlns:common="${NAV_NS_COMMON}" xmlns="${NAV_NS_API}">
${buildHeaderXml(requestId, timestamp)}
${buildUserXml(credentials, requestId, timestamp)}
${buildSoftwareXml(software)}
  <transactionId>${escapeXml(transactionId)}</transactionId>
  <returnOriginalRequest>${returnOriginalRequest}</returnOriginalRequest>
</QueryTransactionStatusRequest>`;
}

export function buildManageInvoiceRequestXml(
  credentials: NavRealCredentials,
  requestId: string,
  timestamp: Date,
  software: NavSoftwareInfo,
  exchangeToken: string,
  operations: NavInvoiceOperationInput[]
): string {
  const signatureOperations: ManageInvoiceSignatureOperation[] = operations
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((op) => ({ operation: op.operation, invoiceDataBase64: op.invoiceDataBase64 }));

  const userXml = buildUserXml(credentials, requestId, timestamp, signatureOperations);

  const operationsXml = operations
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(
      (op) => `    <invoiceOperation>
      <index>${op.index}</index>
      <invoiceOperation>${op.operation}</invoiceOperation>
      <invoiceData>${op.invoiceDataBase64}</invoiceData>
    </invoiceOperation>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ManageInvoiceRequest xmlns:common="${NAV_NS_COMMON}" xmlns="${NAV_NS_API}">
${buildHeaderXml(requestId, timestamp)}
${userXml}
${buildSoftwareXml(software)}
  <exchangeToken>${escapeXml(exchangeToken)}</exchangeToken>
  <invoiceOperations>
    <compressedContent>false</compressedContent>
${operationsXml}
  </invoiceOperations>
</ManageInvoiceRequest>`;
}
