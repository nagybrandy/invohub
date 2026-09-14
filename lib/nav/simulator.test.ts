// lib/nav/simulator.test.ts
import { createNavSimulatorClient } from "@/lib/nav/simulator";

function invoiceDataBase64(customerTaxpayerId: string | null) {
  const customerBlock = customerTaxpayerId
    ? `<customerInfo><customerVatData><customerTaxNumber><taxpayerId>${customerTaxpayerId}</taxpayerId></customerTaxNumber></customerVatData></customerInfo>`
    : "";
  const xml = `<InvoiceData><invoiceMain><invoice><invoiceHead>${customerBlock}</invoiceHead></invoice></invoiceMain></InvoiceData>`;
  return Buffer.from(xml, "utf8").toString("base64");
}

describe("NAV demo simulator", () => {
  it("tokenExchange resolves instantly with a placeholder token, no credentials needed", async () => {
    const client = createNavSimulatorClient();
    const result = await client.tokenExchange(null);
    expect(result.exchangeToken).toBeTruthy();
  });

  it("transitions PROCESSING -> DONE across two status polls", async () => {
    const client = createNavSimulatorClient();
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);

    const { transactionId } = await client.manageInvoice(null, "tok", [
      { index: 1, operation: "CREATE", invoiceDataBase64: invoiceDataBase64("12345678") },
    ]);

    nowSpy.mockReturnValue(1_000_500); // first poll, shortly after submit
    const first = await client.queryTransactionStatus(null, transactionId);
    expect(first.status).toBe("PROCESSING");

    nowSpy.mockReturnValue(1_010_000); // second poll, well after submit
    const second = await client.queryTransactionStatus(null, transactionId);
    expect(second.status).toBe("DONE");

    nowSpy.mockRestore();
  });

  it("returns ABORTED with a validation message for a malformed customer tax number", async () => {
    const client = createNavSimulatorClient();
    const { transactionId } = await client.manageInvoice(null, "tok", [
      { index: 1, operation: "CREATE", invoiceDataBase64: invoiceDataBase64("not-8-digits") },
    ]);
    const status = await client.queryTransactionStatus(null, transactionId);
    expect(status.status).toBe("ABORTED");
    expect(status.messages.length).toBeGreaterThan(0);
  });

  it("does not abort invoices with no customer tax number (private person / consumer invoices)", async () => {
    const client = createNavSimulatorClient();
    const { transactionId } = await client.manageInvoice(null, "tok", [
      { index: 1, operation: "CREATE", invoiceDataBase64: invoiceDataBase64(null) },
    ]);
    const status = await client.queryTransactionStatus(null, transactionId);
    expect(status.status).not.toBe("ABORTED");
  });

  it("queryTaxpayer returns deterministic demo taxpayers for known ids and a generic valid result for other 8-digit ids", async () => {
    const client = createNavSimulatorClient();
    const known = await client.queryTaxpayer(null, "12345678");
    expect(known).toMatchObject({ valid: true, name: expect.any(String) });

    const generic = await client.queryTaxpayer(null, "55555555");
    expect(generic.valid).toBe(true);

    const invalid = await client.queryTaxpayer(null, "abc");
    expect(invalid.valid).toBe(false);
  });

  it("queryTransactionStatus reports an unknown transactionId as ABORTED rather than crashing", async () => {
    const client = createNavSimulatorClient();
    const status = await client.queryTransactionStatus(null, "not-a-real-id");
    expect(status.status).toBe("ABORTED");
  });
});
