// lib/invoices/types.test.ts
import { hasBuyerAddress, hasInvoiceNumber, requiresCompleteBuyerAddress } from "@/lib/invoices/types";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("hasInvoiceNumber", () => {
  it("is false for a blank invoiceNumber", () => {
    expect(hasInvoiceNumber(makeInvoice({ invoiceNumber: "" }))).toBe(false);
  });

  it("is true once a number is assigned", () => {
    expect(hasInvoiceNumber(makeInvoice({ invoiceNumber: "INV-2026-001" }))).toBe(true);
  });
});

describe("hasBuyerAddress (Áfa tv. 169. § e)", () => {
  const complete = makeInvoice({
    clientName: "Acme Kft.",
    clientZipCode: "1011",
    clientCity: "Budapest",
    clientAddress: "Fő utca 1.",
  });

  it("is true when name, zip, city and address are all set", () => {
    expect(hasBuyerAddress(complete)).toBe(true);
  });

  it("is false when the buyer name is blank", () => {
    expect(hasBuyerAddress({ ...complete, clientName: "   " })).toBe(false);
  });

  it("is false when the zip code is missing", () => {
    expect(hasBuyerAddress({ ...complete, clientZipCode: undefined })).toBe(false);
  });

  it("is false when the city is missing", () => {
    expect(hasBuyerAddress({ ...complete, clientCity: undefined })).toBe(false);
  });

  it("is false when the street address is missing", () => {
    expect(hasBuyerAddress({ ...complete, clientAddress: undefined })).toBe(false);
  });

  it("is false when a field is only whitespace", () => {
    expect(hasBuyerAddress({ ...complete, clientAddress: "   " })).toBe(false);
  });

  it("is false for a fresh draft with no address fields at all", () => {
    expect(hasBuyerAddress(makeInvoice())).toBe(false);
  });
});

describe("requiresCompleteBuyerAddress", () => {
  it("is false for a draft (any document type)", () => {
    expect(requiresCompleteBuyerAddress({ status: "draft", documentType: "invoice" })).toBe(false);
    expect(requiresCompleteBuyerAddress({ status: "draft", documentType: "proforma" })).toBe(false);
  });

  it("is true for a finalized invoice/advance/storno/modify", () => {
    for (const documentType of ["invoice", "advance", "storno", "modify"] as const) {
      expect(requiresCompleteBuyerAddress({ status: "sent", documentType })).toBe(true);
      expect(requiresCompleteBuyerAddress({ status: "unpaid", documentType })).toBe(true);
    }
  });

  it("is false for a proforma even once its status is proforma (not an accounting document)", () => {
    expect(requiresCompleteBuyerAddress({ status: "proforma", documentType: "proforma" })).toBe(false);
  });
});
