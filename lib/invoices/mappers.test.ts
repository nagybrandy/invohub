// lib/invoices/mappers.test.ts
import {
  mapInvoiceFromDb,
  mapInvoiceToDb,
  mapLineItemFromDb,
  mapLineItemToDb,
} from "@/lib/invoices/mappers";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("mapLineItemFromDb", () => {
  it("converts numeric strings to numbers", () => {
    const row = {
      id: "line-1",
      invoiceId: "inv-1",
      description: "Service",
      quantity: "2.5",
      unitPrice: "100.00",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapLineItemFromDb(row)).toEqual({
      id: "line-1",
      description: "Service",
      quantity: 2.5,
      unitPrice: 100,
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: undefined,
    });
  });

  it("defaults vatCategory to normal for legacy rows without the column value", () => {
    const row = {
      id: "line-1",
      invoiceId: "inv-1",
      description: "Service",
      quantity: "1",
      unitPrice: "100",
      vatRate: 27,
      vatCategory: undefined as unknown as string,
      vatExemptionReason: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapLineItemFromDb(row).vatCategory).toBe("normal");
  });

  it("passes through an explicit exemption reason", () => {
    const row = {
      id: "line-1",
      invoiceId: "inv-1",
      description: "Consulting",
      quantity: "1",
      unitPrice: "100",
      vatRate: 0,
      vatCategory: "AAM",
      vatExemptionReason: "Custom reason",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapLineItemFromDb(row).vatExemptionReason).toBe("Custom reason");
  });

  it("maps a unit column value through", () => {
    const row = {
      id: "line-1",
      invoiceId: "inv-1",
      description: "Consulting",
      quantity: "1",
      unitPrice: "100",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      unit: "óra",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapLineItemFromDb(row).unit).toBe("óra");
  });

  it("maps a null unit column to undefined", () => {
    const row = {
      id: "line-1",
      invoiceId: "inv-1",
      description: "Consulting",
      quantity: "1",
      unitPrice: "100",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      unit: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    expect(mapLineItemFromDb(row).unit).toBeUndefined();
  });
});

describe("mapInvoiceFromDb", () => {
  const baseRow = {
    id: "inv-1",
    userId: "user-1",
    companyId: null,
    clientId: null,
    invoiceNumber: "INV-001",
    documentType: "invoice",
    clientName: "Acme",
    clientTaxNumber: null,
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    status: "draft",
    currency: "HUF",
    exchangeRate: null,
    notes: null,
    paymentLink: null,
    paymentMethod: null,
    paidAt: null,
    paidAmount: null,
    originalInvoiceId: null,
    modifiesInvoiceId: null,
    modificationIndex: null,
    createdAt: now,
    updatedAt: now,
  };

  it("maps buyer address snapshot fields through (Áfa tv. 169. § e)", () => {
    const row = {
      ...baseRow,
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
      clientCountry: "Magyarország",
      clientEuVatNumber: "HU12345678",
    };
    const invoice = mapInvoiceFromDb(row, []);
    expect(invoice.clientZipCode).toBe("1011");
    expect(invoice.clientCity).toBe("Budapest");
    expect(invoice.clientAddress).toBe("Fő utca 1.");
    expect(invoice.clientCountry).toBe("Magyarország");
    expect(invoice.clientEuVatNumber).toBe("HU12345678");
  });

  it("maps missing buyer address snapshot columns to undefined (legacy rows)", () => {
    const invoice = mapInvoiceFromDb(baseRow, []);
    expect(invoice.clientZipCode).toBeUndefined();
    expect(invoice.clientCity).toBeUndefined();
    expect(invoice.clientAddress).toBeUndefined();
    expect(invoice.clientCountry).toBeUndefined();
    expect(invoice.clientEuVatNumber).toBeUndefined();
  });

  it("maps invoice row and sorts line items", () => {
    const items = [
      {
        id: "line-2",
        invoiceId: "inv-1",
        description: "Second",
        quantity: "1",
        unitPrice: "10",
        vatRate: 27,
        vatCategory: "normal",
        vatExemptionReason: null,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "line-1",
        invoiceId: "inv-1",
        description: "First",
        quantity: "1",
        unitPrice: "20",
        vatRate: 27,
        vatCategory: "normal",
        vatExemptionReason: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const invoice = mapInvoiceFromDb(baseRow, items);
    expect(invoice.lineItems[0].description).toBe("First");
    expect(invoice.lineItems[1].description).toBe("Second");
    expect(invoice.clientTaxNumber).toBeUndefined();
    expect(invoice.documentType).toBe("invoice");
    expect(invoice.paymentMethod).toBeUndefined();
    expect(invoice.paidAt).toBeUndefined();
    expect(invoice.paidAmount).toBeUndefined();
  });

  it("maps payment, storno, and modification fields when set", () => {
    const row = {
      ...baseRow,
      paymentMethod: "cash",
      paidAt: now,
      paidAmount: "199.50",
      originalInvoiceId: "inv-orig",
      modifiesInvoiceId: "inv-mod-source",
      modificationIndex: 2,
      exchangeRate: "1.0000",
    };
    const invoice = mapInvoiceFromDb(row, []);
    expect(invoice.paymentMethod).toBe("cash");
    expect(invoice.paidAt).toBe(now.toISOString());
    expect(invoice.paidAmount).toBe(199.5);
    expect(invoice.originalInvoiceId).toBe("inv-orig");
    expect(invoice.modifiesInvoiceId).toBe("inv-mod-source");
    expect(invoice.modificationIndex).toBe(2);
    expect(invoice.exchangeRate).toBe(1);
  });

  it("defaults documentType to invoice for legacy rows", () => {
    const row = { ...baseRow, documentType: undefined as unknown as string };
    expect(mapInvoiceFromDb(row, []).documentType).toBe("invoice");
  });
});

describe("mapLineItemToDb", () => {
  it("serializes numbers as strings", () => {
    expect(mapLineItemToDb(makeLineItem(), "inv-1", 0)).toEqual({
      id: "line-1",
      invoiceId: "inv-1",
      description: "Consulting",
      quantity: "2",
      unitPrice: "100",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      unit: null,
      sortOrder: 0,
    });
  });

  it("passes a set unit through", () => {
    expect(mapLineItemToDb(makeLineItem({ unit: "óra" }), "inv-1", 0)).toMatchObject({
      unit: "óra",
    });
  });
});

describe("mapInvoiceToDb", () => {
  it("maps domain invoice to DB shape including clientId", () => {
    const inv = makeInvoice({ clientId: "cli-9" });
    expect(mapInvoiceToDb(inv, "user-1")).toMatchObject({
      id: "inv-1",
      userId: "user-1",
      invoiceNumber: "INV-2026-001",
      documentType: "invoice",
      clientName: "Acme Kft.",
      clientId: "cli-9",
      status: "sent",
      paymentMethod: null,
      originalInvoiceId: null,
      modifiesInvoiceId: null,
    });
  });

  it("serializes the buyer address snapshot, and nulls out unset fields", () => {
    const inv = makeInvoice({
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
      clientCountry: "Magyarország",
      clientEuVatNumber: "HU12345678",
    });
    expect(mapInvoiceToDb(inv, "user-1")).toMatchObject({
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
      clientCountry: "Magyarország",
      clientEuVatNumber: "HU12345678",
    });
    expect(mapInvoiceToDb(makeInvoice(), "user-1")).toMatchObject({
      clientZipCode: null,
      clientCity: null,
      clientAddress: null,
      clientCountry: null,
      clientEuVatNumber: null,
    });
  });

  it("serializes payment and correction fields", () => {
    const inv = makeInvoice({
      paymentMethod: "card",
      paidAt: "2026-06-05T10:00:00.000Z",
      paidAmount: 254,
      originalInvoiceId: "inv-orig",
      modifiesInvoiceId: "inv-mod",
      modificationIndex: 1,
      exchangeRate: 390.5,
    });
    expect(mapInvoiceToDb(inv, "user-1")).toMatchObject({
      paymentMethod: "card",
      paidAmount: "254",
      originalInvoiceId: "inv-orig",
      modifiesInvoiceId: "inv-mod",
      modificationIndex: 1,
      exchangeRate: "390.5",
    });
  });
});
