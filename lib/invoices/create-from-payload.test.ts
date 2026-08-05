// lib/invoices/create-from-payload.test.ts
jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
  upsertInvoice: jest.fn(),
}));

import {
  validateExternalInvoiceInput,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";

describe("validateExternalInvoiceInput", () => {
  const valid: ExternalInvoiceInput = {
    clientName: "Client Kft.",
    lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 10000, vatRate: 27 }],
  };

  it("accepts valid payload", () => {
    expect(validateExternalInvoiceInput(valid)).toBeNull();
  });

  it("requires clientName", () => {
    expect(validateExternalInvoiceInput({ ...valid, clientName: "" })).toContain(
      "clientName"
    );
  });

  it("requires lineItems", () => {
    expect(validateExternalInvoiceInput({ clientName: "X", lineItems: [] })).toContain(
      "lineItems"
    );
  });

  it("validates vatRate", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        lineItems: [{ description: "X", quantity: 1, unitPrice: 1, vatRate: 99 as 27 }],
      })
    ).toContain("vatRate");
  });

  it("validates emailTo format", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        emailTo: ["billing@acme.hu", "not-an-email"],
      })
    ).toContain("emailTo");
  });

  it("accepts emailTo as array", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        emailTo: ["billing@acme.hu", "accounting@acme.hu"],
      })
    ).toBeNull();
  });
});
