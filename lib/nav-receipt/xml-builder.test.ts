// lib/nav-receipt/xml-builder.test.ts
import { buildAuthTokenXml, buildCreateReceiptXml } from "@/lib/nav-receipt/xml-builder";
import type { DailyReceiptReport, NavReceiptCredentials } from "@/lib/nav-receipt/types";

const testCredentials: NavReceiptCredentials = {
  technicalUser: "testuser",
  technicalPassword: "testpass",
  signingKey: "signkey123",
  taxNumber: "12345678-1-42",
};

describe("buildAuthTokenXml", () => {
  it("emits the root element in the eRECEIPT namespace", () => {
    const xml = buildAuthTokenXml(testCredentials);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toMatch(
      /<AuthTokenRequest[^>]*xmlns="http:\/\/schemas\.nav\.gov\.hu\/NTCA\/1\.0\/receipt"/
    );
  });

  it("never emits the invented TokenExchangeRequest root anywhere in lib/nav-receipt/", () => {
    const xml = buildAuthTokenXml(testCredentials);
    expect(xml).not.toContain("TokenExchangeRequest");
  });

  it("orders top-level children context, auth, requestVersion, headerVersion", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const contextIdx = xml.indexOf("<context>");
    const authIdx = xml.indexOf("<auth>");
    const requestVersionIdx = xml.indexOf("<requestVersion>");
    const headerVersionIdx = xml.indexOf("<headerVersion>");

    expect(contextIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(contextIdx);
    expect(requestVersionIdx).toBeGreaterThan(authIdx);
    expect(headerVersionIdx).toBeGreaterThan(requestVersionIdx);
  });

  it("orders auth children login, passwordHash, taxNumber, requestSignature", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const loginIdx = xml.indexOf("<login>");
    const passwordHashIdx = xml.indexOf("<passwordHash");
    const taxNumberIdx = xml.indexOf("<taxNumber>");
    const requestSignatureIdx = xml.indexOf("<requestSignature");

    expect(loginIdx).toBeGreaterThan(-1);
    expect(passwordHashIdx).toBeGreaterThan(loginIdx);
    expect(taxNumberIdx).toBeGreaterThan(passwordHashIdx);
    expect(requestSignatureIdx).toBeGreaterThan(taxNumberIdx);
  });

  it("hashes the password as 128 uppercase SHA-512 hex chars with cryptoType", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const match = xml.match(/<passwordHash cryptoType="SHA-512">([^<]+)</);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[A-F0-9]{128}$/);
  });

  it("signs the request as 128 uppercase SHA3-512 hex chars with cryptoType", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const match = xml.match(/<requestSignature cryptoType="SHA3-512">([^<]+)</);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[A-F0-9]{128}$/);
  });

  it("emits a context/requestId matching the legacy requestId pattern", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const match = xml.match(/<context>\s*<requestId>([^<]+)</);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[+A-Za-z0-9_]{1,30}$/);
  });

  it("normalizes the auth taxNumber to the 8-digit TaxpayerIdType shape", () => {
    const xml = buildAuthTokenXml(testCredentials);
    const match = xml.match(/<taxNumber>([^<]+)</);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[0-9]{8}$/);
  });
});

const hufReport: DailyReceiptReport = {
  taxPayerId: "12345678",
  issuingSoftwareName: "InvoHub",
  applicableDate: "2026-09-01",
  serialNumber: "NYG-2026-001",
  currency: "HUF",
  exchangeRate: null,
  vatCategoryItems: [
    { vat: "27%", saleDocument: 127000, modifyingDocument: 0 },
    { vat: "5%", saleDocument: 52500, modifyingDocument: 0 },
  ],
  total: 179500,
  numberOfSaleDocument: 50,
  numberOfModifyingDocument: 0,
};

describe("buildCreateReceiptXml", () => {
  it("emits the root element as CreateReceiptRequest", () => {
    const xml = buildCreateReceiptXml(hufReport);
    expect(xml).toContain("<CreateReceiptRequest");
  });

  it("orders top-level children in the exact XSD sequence", () => {
    const xml = buildCreateReceiptXml(hufReport);
    const order = [
      "<context>",
      "<taxPayerId>",
      "<issuingSoftware>",
      "<applicableDate>",
      "<serialNumber>",
      "<currency>",
      "<exchangeRate",
      "<vatCategoryItems>",
      "<total>",
      "<numberOfSaleDocument>",
      "<numberOfModifyingDocument>",
    ];
    const indexes = order.map((tag) => xml.indexOf(tag));
    for (const idx of indexes) expect(idx).toBeGreaterThan(-1);
    for (let i = 1; i < indexes.length; i++) {
      expect(indexes[i]).toBeGreaterThan(indexes[i - 1]);
    }
  });

  it("emits issuingSoftware/name as a nested child", () => {
    const xml = buildCreateReceiptXml(hufReport);
    expect(xml).toMatch(/<issuingSoftware>\s*<name>InvoHub<\/name>\s*<\/issuingSoftware>/);
  });

  it("emits one vatCategory per category, ordered vat, saleDocument, modifyingDocument", () => {
    const xml = buildCreateReceiptXml(hufReport);
    const categories = xml.match(/<vatCategory>[\s\S]*?<\/vatCategory>/g);
    expect(categories).toHaveLength(2);
    for (const block of categories!) {
      const vatIdx = block.indexOf("<vat>");
      const saleIdx = block.indexOf("<saleDocument>");
      const modifyIdx = block.indexOf("<modifyingDocument>");
      expect(vatIdx).toBeGreaterThan(-1);
      expect(saleIdx).toBeGreaterThan(vatIdx);
      expect(modifyIdx).toBeGreaterThan(saleIdx);
    }
  });

  it("never emits any of the invented old fields", () => {
    const xml = buildCreateReceiptXml(hufReport);
    for (const invented of [
      "netAmount",
      "vatAmount",
      "grossAmount",
      "vatRateCode",
      "cancelledCount",
      "startReceiptNumber",
      "endReceiptNumber",
    ]) {
      expect(xml).not.toContain(`<${invented}`);
    }
  });

  it("emits xsi:nil exchangeRate with the xsi namespace declared for a HUF report", () => {
    const xml = buildCreateReceiptXml(hufReport);
    expect(xml).toMatch(/xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/);
    expect(xml).toContain('<exchangeRate xsi:nil="true"/>');
  });

  it("throws when asked to build a non-HUF report", () => {
    const eurReport: DailyReceiptReport = { ...hufReport, currency: "EUR" };
    expect(() => buildCreateReceiptXml(eurReport)).toThrow();
  });

  it("escapes &, <, > in the issuing-software name and serial number", () => {
    const report: DailyReceiptReport = {
      ...hufReport,
      issuingSoftwareName: 'Invo<Hub> & "Co"',
      serialNumber: "NYG<2026>&001",
    };
    const xml = buildCreateReceiptXml(report);
    expect(xml).toContain("Invo&lt;Hub&gt; &amp;");
    expect(xml).toContain("NYG&lt;2026&gt;&amp;001");
    expect(xml).not.toContain("Invo<Hub>");
    expect(xml).not.toContain("NYG<2026>&001");
  });

  it("emits total/saleDocument/modifyingDocument with exactly 2 decimal places", () => {
    const report: DailyReceiptReport = {
      ...hufReport,
      total: 179500,
      vatCategoryItems: [{ vat: "27%", saleDocument: 127000, modifyingDocument: -5.5 }],
    };
    const xml = buildCreateReceiptXml(report);
    expect(xml).toContain("<total>179500.00</total>");
    expect(xml).toContain("<saleDocument>127000.00</saleDocument>");
    expect(xml).toContain("<modifyingDocument>-5.50</modifyingDocument>");
  });
});
