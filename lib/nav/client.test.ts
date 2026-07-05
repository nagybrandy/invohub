// lib/nav/client.test.ts
import { fetchIncomingInvoices, submitInvoiceToNav } from "@/lib/nav/client";

describe("NAV client stubs", () => {
  const credentials = {
    technicalUser: "test",
    xmlSignKey: "key",
    taxNumber: "12345678-1-23",
    environment: "test" as const,
  };

  it("fetchIncomingInvoices returns mock invoices", async () => {
    const invoices = await fetchIncomingInvoices(credentials);
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0].navInvoiceId).toContain("NAV-TEST");
    expect(invoices[0]).toMatchObject({
      supplierName: expect.any(String),
      invoiceNumber: expect.any(String),
      currency: "HUF",
    });
  });

  it("submitInvoiceToNav returns accepted status", async () => {
    const result = await submitInvoiceToNav(credentials, "<invoice/>");
    expect(result.status).toBe("accepted");
    expect(result.environment).toBe("test");
    expect(result.transactionId).toMatch(/^NAV-TEST-TXN-/);
  });

  it("submitInvoiceToNav tags live submissions", async () => {
    const result = await submitInvoiceToNav(
      { ...credentials, environment: "production" },
      "<invoice/>"
    );
    expect(result.environment).toBe("production");
    expect(result.transactionId).toMatch(/^NAV-LIVE-TXN-/);
  });
});
