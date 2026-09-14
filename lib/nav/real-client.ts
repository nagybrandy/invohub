// lib/nav/real-client.ts
// Real NAV Online Számla v3.0 client (test or production endpoint). Server
// only — uses Node's global fetch to POST XML bodies and parses the XML
// responses with the small regex helpers in xml-utils.ts (see the note
// there on why a full DOM parser isn't used for this MVP).
import { decryptExchangeToken, isValidSoftwareId } from "@/lib/nav/crypto";
import { NAV_API_BASE_URL, type NavEnvironment } from "@/lib/nav/environment";
import {
  buildManageInvoiceRequestXml,
  buildQueryTaxpayerRequestXml,
  buildQueryTransactionStatusRequestXml,
  buildTokenExchangeRequestXml,
  generateNavRequestId,
  getNavSoftwareInfo,
} from "@/lib/nav/request-xml";
import type { NavRealCredentials } from "@/lib/nav/resolve-credentials";
import type {
  NavClient,
  NavInvoiceOperationInput,
  NavTaxpayerQueryResult,
  NavTransactionStatusResult,
  NavTransactionStatusValue,
} from "@/lib/nav/types";
import { extractAllTags, extractBlock, extractTag } from "@/lib/nav/xml-utils";

function requireCredentials(credentials: NavRealCredentials | null): NavRealCredentials {
  if (!credentials) {
    throw new Error("NAV real client called without credentials (this is a demo-only code path bug).");
  }
  return credentials;
}

async function postXml(url: string, body: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/xml; charset=UTF-8" },
    body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

/** NAV error envelopes carry funcCode=ERROR (or a non-OK result) plus errorCode/message. */
function assertNoResultError(xml: string, operationLabel: string) {
  const funcCode = extractTag(xml, "funcCode");
  if (funcCode && funcCode !== "OK") {
    const errorCode = extractTag(xml, "errorCode") ?? funcCode;
    const message = extractTag(xml, "message") ?? "Ismeretlen NAV hiba.";
    throw new Error(`NAV ${operationLabel} hiba (${errorCode}): ${message}`);
  }
}

function mapInvoiceStatus(raw: string | null): NavTransactionStatusValue {
  switch (raw) {
    case "DONE":
    case "ABORTED":
    case "SAVED":
    case "PROCESSING":
    case "RECEIVED":
      return raw;
    default:
      return "PROCESSING";
  }
}

export function createNavRealClient(environment: Exclude<NavEnvironment, "demo">): NavClient {
  const baseUrl = NAV_API_BASE_URL[environment];
  const software = getNavSoftwareInfo();

  function assertSoftwareConfigured() {
    if (!isValidSoftwareId(software.softwareId)) {
      throw new Error(
        "NAV_SOFTWARE_ID hiányzik vagy érvénytelen — pontosan 18 nagybetűs/számjegyű karakternek kell lennie."
      );
    }
  }

  return {
    environment,

    async tokenExchange(rawCredentials) {
      assertSoftwareConfigured();
      const credentials = requireCredentials(rawCredentials);
      const requestId = generateNavRequestId();
      const timestamp = new Date();
      const xml = buildTokenExchangeRequestXml(credentials, requestId, timestamp, software);
      const { status, text } = await postXml(`${baseUrl}/tokenExchange`, xml);
      if (status >= 400) {
        throw new Error(`NAV tokenExchange HTTP ${status}: ${text.slice(0, 300)}`);
      }
      assertNoResultError(text, "tokenExchange");
      const encodedExchangeToken = extractTag(text, "encodedExchangeToken");
      if (!encodedExchangeToken) {
        throw new Error("A NAV tokenExchange válasz nem tartalmazott encodedExchangeToken elemet.");
      }
      const exchangeToken = decryptExchangeToken(encodedExchangeToken, credentials.exchangeKey);
      return { exchangeToken };
    },

    async manageInvoice(rawCredentials, exchangeToken, operations: NavInvoiceOperationInput[]) {
      assertSoftwareConfigured();
      const credentials = requireCredentials(rawCredentials);
      const requestId = generateNavRequestId();
      const timestamp = new Date();
      const xml = buildManageInvoiceRequestXml(credentials, requestId, timestamp, software, exchangeToken, operations);
      const { status, text } = await postXml(`${baseUrl}/manageInvoice`, xml);
      if (status >= 400) {
        throw new Error(`NAV manageInvoice HTTP ${status}: ${text.slice(0, 300)}`);
      }
      assertNoResultError(text, "manageInvoice");
      const transactionId = extractTag(text, "transactionId");
      if (!transactionId) {
        throw new Error("A NAV manageInvoice válasz nem tartalmazott transactionId elemet.");
      }
      return { transactionId };
    },

    async queryTransactionStatus(rawCredentials, transactionId): Promise<NavTransactionStatusResult> {
      assertSoftwareConfigured();
      const credentials = requireCredentials(rawCredentials);
      const requestId = generateNavRequestId();
      const timestamp = new Date();
      const xml = buildQueryTransactionStatusRequestXml(credentials, requestId, timestamp, software, transactionId);
      const { status, text } = await postXml(`${baseUrl}/queryTransactionStatus`, xml);
      if (status >= 400) {
        throw new Error(`NAV queryTransactionStatus HTTP ${status}: ${text.slice(0, 300)}`);
      }
      assertNoResultError(text, "queryTransactionStatus");

      const processingResult = extractBlock(text, "processingResult") ?? text;
      const invoiceStatus = mapInvoiceStatus(extractTag(processingResult, "invoiceStatus"));
      const technicalMessages = extractAllTags(text, "message");
      const businessMessages = extractAllTags(text, "validationResultCode").map(
        (code) => `Üzleti validáció: ${code}`
      );

      return {
        transactionId,
        status: invoiceStatus,
        messages: [...technicalMessages, ...businessMessages].filter(Boolean),
      };
    },

    async queryTaxpayer(rawCredentials, taxNumber): Promise<NavTaxpayerQueryResult> {
      assertSoftwareConfigured();
      const credentials = requireCredentials(rawCredentials);
      const requestId = generateNavRequestId();
      const timestamp = new Date();
      const xml = buildQueryTaxpayerRequestXml(credentials, requestId, timestamp, software, taxNumber);
      const { status, text } = await postXml(`${baseUrl}/queryTaxpayer`, xml);
      if (status >= 400) {
        throw new Error(`NAV queryTaxpayer HTTP ${status}: ${text.slice(0, 300)}`);
      }
      assertNoResultError(text, "queryTaxpayer");

      const valid = extractTag(text, "taxpayerValidity") === "true";
      if (!valid) return { valid: false };

      const addressBlock = extractBlock(text, "taxpayerAddressList") ?? text;
      return {
        valid: true,
        name: extractTag(text, "taxpayerName") ?? undefined,
        city: extractTag(addressBlock, "city") ?? undefined,
        zipCode: extractTag(addressBlock, "postalCode") ?? undefined,
        address: extractTag(addressBlock, "streetName") ?? undefined,
        country: extractTag(addressBlock, "countryCode") ?? "HU",
      };
    },
  };
}
