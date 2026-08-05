// lib/nav-receipt/xml-builder.test.ts
import {
  buildAuthenticateXml,
  buildReceiptDataReportXml,
  buildSoftwareRegistrationXml,
} from "@/lib/nav-receipt/xml-builder";
import type { DailyReceiptReport, NavReceiptCredentials } from "@/lib/nav-receipt/types";

const testCredentials: NavReceiptCredentials = {
  technicalUser: "testuser",
  technicalPassword: "testpass",
  signingKey: "signkey123",
  taxNumber: "12345678",
};

describe("buildAuthenticateXml", () => {
  it("produces valid XML with user credentials", () => {
    const xml = buildAuthenticateXml(testCredentials);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<TokenExchangeRequest");
    expect(xml).toContain("<common:login>testuser</common:login>");
    expect(xml).toContain('cryptoType="SHA-512"');
    expect(xml).toContain("<common:taxNumber>12345678</common:taxNumber>");
  });

  it("hashes the password as uppercase SHA-512 hex", () => {
    const xml = buildAuthenticateXml(testCredentials);
    const match = xml.match(/<common:passwordHash[^>]*>([^<]+)</);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^[A-F0-9]{128}$/);
  });
});

describe("buildSoftwareRegistrationXml", () => {
  it("includes software name and dev details", () => {
    const xml = buildSoftwareRegistrationXml(testCredentials, "MyCashRegister");
    expect(xml).toContain("<SoftwareRegistrationRequest");
    expect(xml).toContain("<softwareName>MyCashRegister</softwareName>");
    expect(xml).toContain("<softwareDevName>InvoHub</softwareDevName>");
  });
});

describe("buildReceiptDataReportXml", () => {
  const report: DailyReceiptReport = {
    taxNumber: "12345678",
    softwareId: "SW-001",
    reportDate: "2026-09-01",
    startReceiptNumber: "R-0001",
    endReceiptNumber: "R-0050",
    receiptCount: 50,
    cancelledCount: 2,
    vatAggregations: [
      {
        vatRate: 27,
        vatRateCode: "27",
        netAmount: 100000,
        vatAmount: 27000,
        grossAmount: 127000,
        receiptCount: 40,
      },
      {
        vatRate: 5,
        vatRateCode: "5",
        netAmount: 50000,
        vatAmount: 2500,
        grossAmount: 52500,
        receiptCount: 10,
      },
    ],
  };

  it("produces XML with report metadata", () => {
    const xml = buildReceiptDataReportXml(report);
    expect(xml).toContain("<ReceiptDataReportRequest");
    expect(xml).toContain("<reportDate>2026-09-01</reportDate>");
    expect(xml).toContain("<receiptCount>50</receiptCount>");
    expect(xml).toContain("<cancelledCount>2</cancelledCount>");
    expect(xml).toContain("<softwareId>SW-001</softwareId>");
  });

  it("includes all VAT aggregation lines", () => {
    const xml = buildReceiptDataReportXml(report);
    expect(xml).toContain("<vatRateCode>27</vatRateCode>");
    expect(xml).toContain("<vatRateCode>5</vatRateCode>");
    expect(xml).toContain("<grossAmount>127000</grossAmount>");
    expect(xml).toContain("<grossAmount>52500</grossAmount>");
  });

  it("escapes XML-special characters in receipt numbers", () => {
    const reportWithSpecial = {
      ...report,
      startReceiptNumber: "R&001<>",
      endReceiptNumber: 'R"050',
    };
    const xml = buildReceiptDataReportXml(reportWithSpecial);
    expect(xml).toContain("<startReceiptNumber>R&amp;001&lt;&gt;</startReceiptNumber>");
    expect(xml).toContain("<endReceiptNumber>R&quot;050</endReceiptNumber>");
  });
});
