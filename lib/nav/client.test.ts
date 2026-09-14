// lib/nav/client.test.ts
import { fetchIncomingInvoices, getNavClient } from "@/lib/nav/client";

describe("NAV client factory", () => {
  it("returns the demo simulator for mode=demo", () => {
    const client = getNavClient("demo");
    expect(client.environment).toBe("demo");
    expect(typeof client.manageInvoice).toBe("function");
    expect(typeof client.queryTransactionStatus).toBe("function");
  });

  it("returns a real OSA client for mode=test", () => {
    const client = getNavClient("test");
    expect(client.environment).toBe("test");
  });

  it("returns a real OSA client for mode=production", () => {
    const client = getNavClient("production");
    expect(client.environment).toBe("production");
  });

  it("demo simulator round-trips manageInvoice -> queryTransactionStatus without any credentials", async () => {
    const client = getNavClient("demo");
    const invoiceDataBase64 = Buffer.from(
      "<InvoiceData><invoiceMain><invoice><invoiceHead><customerInfo><customerVatData><customerTaxNumber><taxpayerId>12345678</taxpayerId></customerTaxNumber></customerVatData></customerInfo></invoiceHead></invoice></invoiceMain></InvoiceData>",
      "utf8"
    ).toString("base64");

    const { exchangeToken } = await client.tokenExchange(null);
    expect(exchangeToken).toBeTruthy();

    const { transactionId } = await client.manageInvoice(null, exchangeToken, [
      { index: 1, operation: "CREATE", invoiceDataBase64 },
    ]);
    expect(transactionId).toBeTruthy();

    const status = await client.queryTransactionStatus(null, transactionId);
    expect(status.status).toBe("PROCESSING");
  });

  it("demo simulator flags a malformed customer tax number as ABORTED", async () => {
    const client = getNavClient("demo");
    const invoiceDataBase64 = Buffer.from(
      "<InvoiceData><invoiceMain><invoice><invoiceHead><customerInfo><customerVatData><customerTaxNumber><taxpayerId>NOTDIGITS</taxpayerId></customerTaxNumber></customerVatData></customerInfo></invoiceHead></invoice></invoiceMain></InvoiceData>",
      "utf8"
    ).toString("base64");

    const { transactionId } = await client.manageInvoice(null, "tok", [
      { index: 1, operation: "CREATE", invoiceDataBase64 },
    ]);
    const status = await client.queryTransactionStatus(null, transactionId);
    expect(status.status).toBe("ABORTED");
    expect(status.messages.join(" ")).toMatch(/adószám/i);
  });
});

describe("fetchIncomingInvoices (legacy demo stub, incoming-sync only)", () => {
  const credentials = {
    technicalUser: "test",
    xmlSignKey: "key",
    taxNumber: "12345678-1-23",
    environment: "test" as const,
  };

  it("returns mock invoices", async () => {
    const invoices = await fetchIncomingInvoices(credentials);
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0].navInvoiceId).toContain("NAV-TEST");
    expect(invoices[0]).toMatchObject({
      supplierName: expect.any(String),
      invoiceNumber: expect.any(String),
      currency: "HUF",
    });
  });
});
