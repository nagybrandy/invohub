// lib/nav/request-xml.test.ts
import {
  buildManageInvoiceRequestXml,
  buildQueryTaxpayerRequestXml,
  buildQueryTransactionStatusRequestXml,
  buildTokenExchangeRequestXml,
  generateNavRequestId,
  getNavSoftwareInfo,
  type NavSoftwareInfo,
} from "@/lib/nav/request-xml";
import { buildPasswordHash, buildRequestSignature } from "@/lib/nav/crypto";
import { extractTag } from "@/lib/nav/xml-utils";
import type { NavRealCredentials } from "@/lib/nav/resolve-credentials";

const credentials: NavRealCredentials = {
  login: "lwilsmn0uqdxe6u",
  password: "pass1234",
  signKey: "sign-key-value",
  exchangeKey: "1234567890ABCDEF",
  taxNumber: "11111111",
  environment: "test",
  source: "own",
};

const software: NavSoftwareInfo = {
  softwareId: "INVOHUB12345678HUA",
  softwareName: "InvoHub",
  softwareOperation: "ONLINE_SERVICE",
  softwareMainVersion: "1.0.0",
  softwareDevName: "InvoHub",
  softwareDevContact: "tech@invohub.hu",
  softwareDevCountryCode: "HU",
};

const requestId = "RIDFIXED123";
const timestamp = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));

describe("request-xml builders", () => {
  it("tokenExchange: has common header/user/software, correct namespaces, and a matching signature", () => {
    const xml = buildTokenExchangeRequestXml(credentials, requestId, timestamp, software);

    expect(xml).toContain('xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"');
    expect(xml).toContain('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"');
    expect(xml).toContain("<TokenExchangeRequest");
    expect(extractTag(xml, "requestId")).toBe(requestId);
    expect(extractTag(xml, "login")).toBe(credentials.login);
    expect(extractTag(xml, "taxNumber")).toBe(credentials.taxNumber);
    expect(extractTag(xml, "passwordHash")).toBe(buildPasswordHash(credentials.password));
    expect(extractTag(xml, "requestSignature")).toBe(
      buildRequestSignature({ requestId, timestamp, signKey: credentials.signKey })
    );
    expect(extractTag(xml, "softwareId")).toBe(software.softwareId);
    // Never put the raw password or sign key on the wire.
    expect(xml).not.toContain(credentials.password);
    expect(xml).not.toContain(credentials.signKey);
  });

  it("queryTaxpayer: includes the target tax number", () => {
    const xml = buildQueryTaxpayerRequestXml(credentials, requestId, timestamp, software, "22222222");
    expect(xml).toContain("<QueryTaxpayerRequest");
    expect(extractTag(xml, "taxNumber")).toBe(credentials.taxNumber); // first occurrence is the user block
    expect(xml).toContain("<taxNumber>22222222</taxNumber>");
  });

  it("queryTransactionStatus: includes transactionId and returnOriginalRequest", () => {
    const xml = buildQueryTransactionStatusRequestXml(
      credentials,
      requestId,
      timestamp,
      software,
      "abc-123-transaction"
    );
    expect(xml).toContain("<QueryTransactionStatusRequest");
    expect(extractTag(xml, "transactionId")).toBe("abc-123-transaction");
    expect(extractTag(xml, "returnOriginalRequest")).toBe("false");
  });

  it("manageInvoice: includes exchangeToken, invoiceOperations with index/operation/invoiceData, and a signature covering all operations", () => {
    const dataA = Buffer.from("<InvoiceData>A</InvoiceData>", "utf8").toString("base64");
    const dataB = Buffer.from("<InvoiceData>B</InvoiceData>", "utf8").toString("base64");

    const xml = buildManageInvoiceRequestXml(credentials, requestId, timestamp, software, "exchange-token-xyz", [
      { index: 1, operation: "CREATE", invoiceDataBase64: dataA },
      { index: 2, operation: "MODIFY", invoiceDataBase64: dataB },
    ]);

    expect(xml).toContain("<ManageInvoiceRequest");
    expect(extractTag(xml, "exchangeToken")).toBe("exchange-token-xyz");
    expect(xml).toContain(`<index>1</index>`);
    expect(xml).toContain(`<index>2</index>`);
    expect(xml).toContain(`<invoiceData>${dataA}</invoiceData>`);
    expect(xml).toContain(`<invoiceData>${dataB}</invoiceData>`);
    expect(xml).toContain("<compressedContent>false</compressedContent>");

    const expectedSignature = buildRequestSignature({
      requestId,
      timestamp,
      signKey: credentials.signKey,
      invoiceOperations: [
        { operation: "CREATE", invoiceDataBase64: dataA },
        { operation: "MODIFY", invoiceDataBase64: dataB },
      ],
    });
    expect(extractTag(xml, "requestSignature")).toBe(expectedSignature);
  });

  it("orders invoiceOperations (and their signature hashes) by index even when passed out of order", () => {
    const dataA = Buffer.from("A", "utf8").toString("base64");
    const dataB = Buffer.from("B", "utf8").toString("base64");

    const xml = buildManageInvoiceRequestXml(credentials, requestId, timestamp, software, "tok", [
      { index: 2, operation: "MODIFY", invoiceDataBase64: dataB },
      { index: 1, operation: "CREATE", invoiceDataBase64: dataA },
    ]);

    const firstIndexPos = xml.indexOf("<index>1</index>");
    const secondIndexPos = xml.indexOf("<index>2</index>");
    expect(firstIndexPos).toBeGreaterThan(-1);
    expect(secondIndexPos).toBeGreaterThan(firstIndexPos);
  });
});

describe("generateNavRequestId", () => {
  it("produces unique, non-empty ids", () => {
    const a = generateNavRequestId();
    const b = generateNavRequestId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("getNavSoftwareInfo", () => {
  const originalId = process.env.NAV_SOFTWARE_ID;
  afterEach(() => {
    if (originalId === undefined) delete process.env.NAV_SOFTWARE_ID;
    else process.env.NAV_SOFTWARE_ID = originalId;
  });

  it("reads softwareId from env and defaults dev country to HU", () => {
    process.env.NAV_SOFTWARE_ID = "INVOHUB12345678HUA";
    const info = getNavSoftwareInfo();
    expect(info.softwareId).toBe("INVOHUB12345678HUA");
    expect(info.softwareDevCountryCode).toBe("HU");
  });
});
