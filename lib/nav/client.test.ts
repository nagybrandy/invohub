// lib/nav/client.test.ts
import { fetchIncomingInvoices, submitInvoiceToNav } from "@/lib/nav/client";

describe("NAV client stubs", () => {
  const credentials = {
    technicalUser: "test",
    xmlSignKey: "key",
    taxNumber: "12345678-1-23",
  };

  it("fetchIncomingInvoices returns mock invoices", async () => {
    const invoices = await fetchIncomingInvoices(credentials);
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0]).toMatchObject({
      supplierName: expect.any(String),
      invoiceNumber: expect.any(String),
      currency: "HUF",
    });
  });

  it("submitInvoiceToNav returns accepted status", async () => {
    const result = await submitInvoiceToNav(credentials, "<invoice/>");
    expect(result.status).toBe("accepted");
    expect(result.transactionId).toMatch(/^NAV-TXN-/);
  });
});
