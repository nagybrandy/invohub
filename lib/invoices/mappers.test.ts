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
    });
  });
});

describe("mapInvoiceFromDb", () => {
  it("maps invoice row and sorts line items", () => {
    const row = {
      id: "inv-1",
      userId: "user-1",
      companyId: null,
      clientId: null,
      invoiceNumber: "INV-001",
      clientName: "Acme",
      clientTaxNumber: null,
      issueDate: "2026-06-01",
      dueDate: "2026-06-15",
      status: "draft",
      currency: "EUR",
      notes: null,
      paymentLink: null,
      createdAt: now,
      updatedAt: now,
    };
    const items = [
      {
        id: "line-2",
        invoiceId: "inv-1",
        description: "Second",
        quantity: "1",
        unitPrice: "10",
        vatRate: 27,
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
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const invoice = mapInvoiceFromDb(row, items);
    expect(invoice.lineItems[0].description).toBe("First");
    expect(invoice.lineItems[1].description).toBe("Second");
    expect(invoice.clientTaxNumber).toBeUndefined();
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
      sortOrder: 0,
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
      clientName: "Acme Kft.",
      clientId: "cli-9",
      status: "sent",
    });
  });
});
