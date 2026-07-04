// lib/nav/submit-outgoing.test.ts
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/db", () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn().mockResolvedValue({
    name: "Demo Kft.",
    taxNumber: "12345678-1-23",
    navTechnicalUser: "nav-user",
    navXmlSignKey: "sign-key",
  }),
}));

jest.mock("@/lib/nav/client", () => ({
  submitInvoiceToNav: jest.fn().mockResolvedValue({
    transactionId: "NAV-TXN-TEST",
    status: "accepted",
  }),
}));

describe("submitOutgoingInvoiceToNav", () => {
  it("builds XML, submits to NAV, and records submission", async () => {
    const invoice = makeInvoice();
    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(result.status).toBe("accepted");
    expect(result.transactionId).toBe("NAV-TXN-TEST");
    expect(result.invoiceXml).toContain("<invoiceNumber>");
    expect(result.submissionId).toBeTruthy();
  });
});
