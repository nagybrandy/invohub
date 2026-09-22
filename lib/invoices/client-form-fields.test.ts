// lib/invoices/client-form-fields.test.ts
import {
  applyClientToFormFields,
  composeInvoiceNotes,
  formatClientBillToLines,
  type InvoiceMetaNotesInput,
} from "@/lib/invoices/client-form-fields";
import type { Client } from "@/lib/clients/service";

const client: Client = {
  id: "cli-1",
  userId: "user-1",
  name: "Minta Stúdió Kft.",
  email: "szamlazas@minta.hu",
  taxNumber: "12345678-1-23",
  address: "Fő utca 1.",
  city: "Budapest",
  zipCode: "1011",
  country: "Magyarország",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("applyClientToFormFields", () => {
  it("copies partner identity and address into form fields", () => {
    expect(applyClientToFormFields(client)).toEqual({
      clientId: "cli-1",
      clientName: "Minta Stúdió Kft.",
      clientTaxNumber: "12345678-1-23",
      clientEmail: "szamlazas@minta.hu",
      clientCountry: "Magyarország",
      clientZip: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
    });
  });
});

describe("formatClientBillToLines", () => {
  it("builds address lines without repeating Hungary", () => {
    expect(formatClientBillToLines(applyClientToFormFields(client))).toEqual([
      "1011 Budapest Fő utca 1.",
      "szamlazas@minta.hu",
    ]);
  });
});

describe("composeInvoiceNotes", () => {
  it("merges user notes with payment and bank meta", () => {
    expect(
      composeInvoiceNotes({
        userNotes: "Köszönjük!",
        paymentMethod: "Átutalás",
        bankAccount: "11773016-00000000",
        billToLines: ["1011 Budapest Fő utca 1."],
      }),
    ).toBe(
      [
        "Köszönjük!",
        "",
        "Fizetés: Átutalás",
        "Bankszámla: 11773016-00000000",
        "Számlázási cím:",
        "1011 Budapest Fő utca 1.",
      ].join("\n"),
    );
  });

  // AC11: fulfillmentDate is a real column now (printed from its own
  // field) — composeInvoiceNotes must never append a "Teljesítés: …" line,
  // or a resaved invoice would print the date twice.
  it("never appends a Teljesítés: line, even if one is passed through legacy fields", () => {
    // fulfillmentDate was removed from InvoiceMetaNotesInput — simulate a
    // stale caller still sending it, via an untyped object.
    const legacyInput = {
      userNotes: "Köszönjük!",
      paymentMethod: "Átutalás",
      bankAccount: "11773016-00000000",
      billToLines: ["1011 Budapest Fő utca 1."],
      fulfillmentDate: "2026-09-12",
    };
    const output = composeInvoiceNotes(legacyInput as InvoiceMetaNotesInput);
    expect(output).not.toContain("Teljesítés:");
  });

  it("returns undefined when everything is blank", () => {
    expect(composeInvoiceNotes({})).toBeUndefined();
  });
});
