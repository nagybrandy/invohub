// lib/invoices/convert-proforma.test.ts
jest.mock("@/lib/id", () => {
  let counter = 0;
  return {
    createId: jest.fn(() => `generated-id-${++counter}`),
  };
});

import {
  buildInvoiceFromProforma,
  canConvertProforma,
  dueDateSpanDays,
} from "@/lib/invoices/convert-proforma";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

describe("dueDateSpanDays", () => {
  it("returns the day span between issue and due date (AC1)", () => {
    expect(dueDateSpanDays("2026-09-01", "2026-09-09")).toBe(8);
  });

  it("never goes negative when due is before issue", () => {
    expect(dueDateSpanDays("2026-09-09", "2026-09-01")).toBe(0);
  });

  it("returns 0 for equal dates", () => {
    expect(dueDateSpanDays("2026-09-01", "2026-09-01")).toBe(0);
  });
});

describe("canConvertProforma", () => {
  it("allows a non-cancelled proforma", () => {
    const invoice = makeInvoice({ documentType: "proforma", status: "proforma" });
    expect(canConvertProforma(invoice)).toEqual({ ok: true });
  });

  it("refuses a non-proforma document type", () => {
    for (const documentType of ["invoice", "advance", "storno", "modify"] as const) {
      const invoice = makeInvoice({ documentType, status: "sent" });
      expect(canConvertProforma(invoice)).toEqual({ ok: false, reason: "notProforma" });
    }
  });

  it("refuses a cancelled proforma", () => {
    const invoice = makeInvoice({ documentType: "proforma", status: "cancelled" });
    expect(canConvertProforma(invoice)).toEqual({ ok: false, reason: "cancelled" });
  });
});

describe("buildInvoiceFromProforma", () => {
  function makeProforma(overrides: Parameters<typeof makeInvoice>[0] = {}) {
    return makeInvoice({
      id: "proforma-1",
      documentType: "proforma",
      status: "proforma",
      invoiceNumber: "DBK-2026-00001",
      issueDate: "2026-09-01",
      dueDate: "2026-09-09",
      clientId: "client-1",
      clientName: "Acme Kft.",
      clientTaxNumber: "12345678-1-23",
      currency: "EUR",
      exchangeRate: 395.5,
      paymentMethod: "transfer",
      paidAt: "2026-09-05T10:00:00.000Z",
      paidAmount: 254,
      originalInvoiceId: undefined,
      modifiesInvoiceId: undefined,
      modificationIndex: undefined,
      lineItems: [
        makeLineItem({
          id: "line-src",
          description: "Consulting",
          quantity: 2,
          unitPrice: 100,
          vatRate: 27,
          vatCategory: "normal",
          vatExemptionReason: undefined,
          unit: "óra",
        }),
      ],
      ...overrides,
    });
  }

  it("produces a draft invoice with a new id and the forward link (AC3)", () => {
    const proforma = makeProforma();
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");

    expect(result.documentType).toBe("invoice");
    expect(result.status).toBe("draft");
    expect(result.invoiceNumber).toBe("");
    expect(result.id).toBeTruthy();
    expect(result.id).not.toBe(proforma.id);
    expect(result.convertedFromInvoiceId).toBe(proforma.id);
  });

  it("re-bases the dates on today using the source's day span (AC4)", () => {
    const proforma = makeProforma();
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");

    expect(result.issueDate).toBe("2026-09-15");
    expect(result.dueDate).toBe("2026-09-23");
  });

  it("copies partner/currency/payment fields unchanged and clears payment/link fields (AC5)", () => {
    const proforma = makeProforma();
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");

    expect(result.clientId).toBe("client-1");
    expect(result.clientName).toBe("Acme Kft.");
    expect(result.clientTaxNumber).toBe("12345678-1-23");
    expect(result.currency).toBe("EUR");
    expect(result.exchangeRate).toBe(395.5);
    expect(result.paymentMethod).toBe("transfer");

    expect(result.paidAt).toBeUndefined();
    expect(result.paidAmount).toBeUndefined();
    expect(result.originalInvoiceId).toBeUndefined();
    expect(result.modifiesInvoiceId).toBeUndefined();
    expect(result.modificationIndex).toBeUndefined();
  });

  it("copies every line item field-for-field with a fresh id (AC6)", () => {
    const proforma = makeProforma();
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");

    expect(result.lineItems).toHaveLength(1);
    const line = result.lineItems[0];
    expect(line.id).toBeTruthy();
    expect(line.id).not.toBe(proforma.lineItems[0].id);
    expect(line.description).toBe("Consulting");
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(100);
    expect(line.vatRate).toBe(27);
    expect(line.vatCategory).toBe("normal");
    expect(line.vatExemptionReason).toBeUndefined();
    expect(line.unit).toBe("óra");
  });

  it("appends the reference line to existing notes, joined with a newline (AC7)", () => {
    const proforma = makeProforma({ notes: "Előleg" });
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");
    expect(result.notes).toBe("Előleg\nDíjbekérő alapján: DBK-2026-00001");
  });

  it("uses exactly the reference line when the source has no notes (AC7)", () => {
    const proforma = makeProforma({ notes: undefined });
    const result = buildInvoiceFromProforma(proforma, "2026-09-15");
    expect(result.notes).toBe("Díjbekérő alapján: DBK-2026-00001");
  });
});
