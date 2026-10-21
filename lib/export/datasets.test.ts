import {
  clientsToCsv,
  exportFilename,
  filterClients,
  filterInvoices,
  filterProducts,
  filterReceipts,
  inDateRange,
  invoiceGrossByCurrency,
  productsToCsv,
  receiptsToCsv,
} from "@/lib/export/datasets";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import type { ReceiptRecord } from "@/lib/receipts/service";

const receipt = (over: Partial<ReceiptRecord>): ReceiptRecord => ({
  id: "r", userId: "u", receiptNumber: "NYG-2026-00001", totalAmount: 1270, currency: "HUF", paymentMethod: "cash",
  qrToken: "t", qrUrl: "/x", navSubmitted: false, lineItems: [], issuedAt: "2026-10-05T10:00:00.000Z",
  createdAt: "", updatedAt: "", ...over,
});

describe("inDateRange", () => {
  it("is inclusive on both ends and open when a bound is missing", () => {
    expect(inDateRange("2026-10-01", "2026-10-01", "2026-10-31")).toBe(true);
    expect(inDateRange("2026-10-31T23:59:00Z", "2026-10-01", "2026-10-31")).toBe(true);
    expect(inDateRange("2026-09-30", "2026-10-01", undefined)).toBe(false);
    expect(inDateRange("2026-11-01", undefined, "2026-10-31")).toBe(false);
    expect(inDateRange("1999-01-01")).toBe(true);
  });
});

describe("filters", () => {
  const invoices = [
    makeInvoice({ id: "a", clientName: "Zöld Kft.", invoiceNumber: "INV-1", issueDate: "2026-09-10", status: "paid" }),
    makeInvoice({ id: "b", clientName: "Kék Bt.", invoiceNumber: "DC-2", issueDate: "2026-10-10", status: "sent", clientTaxNumber: "12345678-2-41" }),
  ];
  it("filters invoices by date range, status and free text (name, number, tax number)", () => {
    expect(filterInvoices(invoices, { from: "2026-10-01" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterInvoices(invoices, { status: "paid" }).map((i) => i.id)).toEqual(["a"]);
    expect(filterInvoices(invoices, { status: "all" })).toHaveLength(2);
    expect(filterInvoices(invoices, { search: "zöld" }).map((i) => i.id)).toEqual(["a"]);
    expect(filterInvoices(invoices, { search: "dc-" }).map((i) => i.id)).toEqual(["b"]);
    expect(filterInvoices(invoices, { search: "12345678-2-41" }).map((i) => i.id)).toEqual(["b"]);
  });
  it("filters receipts, partners and products", () => {
    const rs = [receipt({ id: "1" }), receipt({ id: "2", issuedAt: "2026-08-01T00:00:00Z", receiptNumber: "NYG-2026-00002" })];
    expect(filterReceipts(rs, { from: "2026-09-01" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterReceipts(rs, { search: "00002" }).map((r) => r.id)).toEqual(["2"]);
    const cs = [{ id: "c", userId: "u", name: "Nordic Trade", taxNumber: "1", city: "Győr", createdAt: "", updatedAt: "" }];
    expect(filterClients(cs, { search: "győr" })).toHaveLength(1);
    expect(filterClients(cs, { search: "xx" })).toHaveLength(0);
    const ps = [{ id: "p", userId: "u", name: "Hosting", unitPrice: 1, createdAt: "", updatedAt: "" }];
    expect(filterProducts(ps, { search: "host" })).toHaveLength(1);
  });
});

describe("csv builders", () => {
  it("writes receipts with the receipt's own number, date, amount and NAV state", () => {
    const csv = receiptsToCsv([receipt({ totalAmount: 1270.5, navSubmitted: true })], {
      header: { number: "Szám", issuedAt: "Kelt", total: "Összeg", currency: "Deviza", paymentMethod: "Fizetés", nav: "NAV" },
      paymentMethod: (m) => (m === "cash" ? "Készpénz" : m),
      navSubmitted: "Beküldve",
      navPending: "Nincs beküldve",
    }, "hu");
    expect(csv).toBe("﻿Szám;Kelt;Összeg;Deviza;Fizetés;NAV\r\nNYG-2026-00001;2026-10-05;1270,50;HUF;Készpénz;Beküldve\r\n");
  });
  it("writes partners and products, leaving unknown fields empty", () => {
    const clients = clientsToCsv([{ id: "c", userId: "u", name: "A; B", createdAt: "", updatedAt: "" }], {
      header: { name: "Név", taxNumber: "Adószám", email: "E-mail", zip: "Irsz.", city: "Város", address: "Cím", country: "Ország" },
    });
    expect(clients).toContain('"A; B";;;;;;');
    const products = productsToCsv([{ id: "p", userId: "u", name: "Hosting", unitPrice: 36000, vatRate: 27, unit: "év", currency: "HUF", createdAt: "", updatedAt: "" }], {
      header: { name: "Név", description: "Leírás", unitPrice: "Egységár", vatRate: "ÁFA", unit: "Egység", currency: "Deviza" },
    }, "en");
    expect(products).toContain("Hosting;;36000.00;27;év;HUF");
  });
});

describe("helpers", () => {
  it("sums gross per currency", () => {
    const a = makeInvoice({ currency: "HUF", lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000, vatRate: 27 })] });
    const b = makeInvoice({ currency: "EUR", lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 0, vatCategory: "AAM" })] });
    expect(invoiceGrossByCurrency([a, a, b])).toEqual({ HUF: 2540, EUR: 100 });
  });
  it("names the file after the dataset, the range and the day", () => {
    const now = new Date("2026-10-21T10:00:00Z");
    expect(exportFilename("invoices", { from: "2026-01-01", to: "2026-03-31", status: "paid" }, now)).toBe("szamlak-2026-01-01_2026-03-31-paid-2026-10-21.csv");
    expect(exportFilename("clients", {}, now)).toBe("partnerek-osszes-2026-10-21.csv");
  });
});
