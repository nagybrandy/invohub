// lib/invoices/client-form-fields.test.ts
import {
  applyClientToFormFields,
  composeInvoiceNotes,
  formatClientBillToLines,
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
      clientEuVatNumber: "",
    });
  });

  it("copies the EU VAT number when the client has one", () => {
    expect(applyClientToFormFields({ ...client, euVatNumber: "HU12345678" }).clientEuVatNumber).toBe(
      "HU12345678"
    );
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
        fulfillmentDate: "2026-09-12",
        billToLines: ["1011 Budapest Fő utca 1."],
      }),
    ).toBe(
      [
        "Köszönjük!",
        "",
        "Teljesítés: 2026-09-12",
        "Fizetés: Átutalás",
        "Bankszámla: 11773016-00000000",
        "Számlázási cím:",
        "1011 Budapest Fő utca 1.",
      ].join("\n"),
    );
  });

  it("returns undefined when everything is blank", () => {
    expect(composeInvoiceNotes({})).toBeUndefined();
  });
});
