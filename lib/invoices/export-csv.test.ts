// lib/invoices/export-csv.test.ts
import { csvExportFilename, invoiceListToCsv, type CsvLabels } from "@/lib/invoices/export-csv";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const labels: CsvLabels = {
  header: {
    number: "Sorszám", type: "Típus", client: "Vevő", clientTaxNumber: "Vevő adószáma",
    issueDate: "Kiállítás", fulfillmentDate: "Teljesítés", dueDate: "Határidő",
    net: "Nettó", vat: "ÁFA", gross: "Bruttó", currency: "Pénznem", status: "Állapot",
    paidAt: "Fizetve", paymentMethod: "Fizetési mód",
  },
  status: (inv) => `status:${inv.status}`,
  documentType: (inv) => `type:${inv.documentType}`,
  paymentMethod: (m) => `pm:${m}`,
  draftNumber: "(piszkozat)",
};

const lines = (csv: string) => csv.split("\r\n");

describe("invoiceListToCsv — a file the könyvelő's Excel opens without a wizard", () => {
  it("starts with a UTF-8 BOM, uses ';' and CRLF, and puts the header first", () => {
    const csv = invoiceListToCsv([makeInvoice()], labels, "hu");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines(csv)[0]).toBe("﻿Sorszám;Típus;Vevő;Vevő adószáma;Kiállítás;Teljesítés;Határidő;Nettó;ÁFA;Bruttó;Pénznem;Állapot;Fizetve;Fizetési mód");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes Hungarian decimals with a comma and English ones with a point", () => {
    const inv = makeInvoice({
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000.5, vatRate: 27 })],
    });
    expect(lines(invoiceListToCsv([inv], labels, "hu"))[1]).toContain(";1000,50;270,14;1270,64;");
    expect(lines(invoiceListToCsv([inv], labels, "en"))[1]).toContain(";1000.50;270.14;1270.64;");
  });

  it("quotes a field holding the separator or a quote, doubling inner quotes", () => {
    const inv = makeInvoice({ clientName: 'Kis; "Nagy" Bt.' });
    expect(lines(invoiceListToCsv([inv], labels, "hu"))[1]).toContain(';"Kis; ""Nagy"" Bt.";');
  });

  it("labels a draft's empty number, falls back to the issue date as fulfilment, and leaves unknowns blank", () => {
    const inv = makeInvoice({ invoiceNumber: "", status: "draft", fulfillmentDate: undefined, issueDate: "2026-09-03", paidAt: undefined, paymentMethod: undefined, clientTaxNumber: undefined });
    const row = lines(invoiceListToCsv([inv], labels, "hu"))[1].split(";");
    expect(row[0]).toBe("(piszkozat)");
    expect(row[3]).toBe("");
    expect(row[5]).toBe("2026-09-03");
    expect(row[12]).toBe("");
    expect(row[13]).toBe("");
  });

  it("prints paidAt as a date, not a timestamp, and the payment method through the label", () => {
    const inv = makeInvoice({ paidAt: "2026-09-10T08:15:00.000Z", paymentMethod: "cash" });
    const row = lines(invoiceListToCsv([inv], labels, "hu"))[1].split(";");
    expect(row[12]).toBe("2026-09-10");
    expect(row[13]).toBe("pm:cash");
  });
});

describe("csvExportFilename — says what the file holds", () => {
  const now = new Date("2026-09-28T10:00:00+02:00");
  it("names the month and the status filter when set", () => {
    expect(csvExportFilename({ month: "2026-08", status: "paid" }, now)).toBe("szamlak-2026-08-paid-2026-09-28.csv");
  });
  it("says 'osszes' with no month and drops the 'all' status", () => {
    expect(csvExportFilename({ status: "all" }, now)).toBe("szamlak-osszes-2026-09-28.csv");
  });
});
