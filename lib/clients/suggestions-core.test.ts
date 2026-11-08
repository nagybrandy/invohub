// lib/clients/suggestions-core.test.ts
import {
  buildPartnerSuggestions,
  foldText,
  paymentTermDays,
  type SuggestionInvoiceRow,
  type SuggestionLineRow,
} from "@/lib/clients/suggestions-core";

function inv(o: Partial<SuggestionInvoiceRow> & { id: string }): SuggestionInvoiceRow {
  return {
    userId: "acct-A",
    clientId: "c1",
    clientName: "Acme Kft.",
    clientTaxNumber: "12345678-1-42",
    issueDate: "2026-10-01",
    dueDate: "2026-10-09",
    currency: "HUF",
    language: null,
    paymentMethod: null,
    documentType: "invoice",
    status: "sent",
    ...o,
  };
}
const line = (invoiceId: string, o: Partial<SuggestionLineRow> = {}): SuggestionLineRow => ({
  invoiceId,
  description: "Munka",
  quantity: "2",
  unitPrice: "100",
  unit: "óra",
  vatRate: 27,
  vatCategory: "normal",
  vatExemptionReason: null,
  comment: null,
  sortOrder: 0,
  ...o,
});

describe("foldText", () => {
  it("is case and accent insensitive", () => {
    expect(foldText("ÁRVÍZtűrő")).toBe("arviztűrő".normalize("NFD").replace(/[̀-ͯ]/g, ""));
    expect(foldText("Kovács")).toBe("kovacs");
  });
});

describe("paymentTermDays", () => {
  it("derives the term from due minus issue date", () => {
    expect(paymentTermDays("2026-10-01", "2026-10-09")).toBe(8);
    expect(paymentTermDays("2026-10-01", "2026-10-01")).toBe(0);
  });
  it("omits nonsense", () => {
    expect(paymentTermDays("2026-10-09", "2026-10-01")).toBeUndefined();
    expect(paymentTermDays("x", "y")).toBeUndefined();
    expect(paymentTermDays("2026-01-01", "2028-01-01")).toBeUndefined();
  });
});

describe("buildPartnerSuggestions", () => {
  const opts = { userId: "acct-A", query: "", limit: 8 };

  it("ranks by most recent issue date, then invoice count", () => {
    const rows = [
      inv({ id: "a1", clientId: "c1", clientName: "Acme", issueDate: "2026-10-01" }),
      inv({ id: "b1", clientId: "c2", clientName: "Beta", issueDate: "2026-10-05" }),
      inv({ id: "c1", clientId: "c3", clientName: "Gamma", issueDate: "2026-10-05" }),
      inv({ id: "c2", clientId: "c3", clientName: "Gamma", issueDate: "2026-09-01" }),
    ];
    const out = buildPartnerSuggestions(rows, [], opts);
    expect(out.map((s) => s.partner.name)).toEqual(["Gamma", "Beta", "Acme"]);
    expect(out[0].invoiceCount).toBe(2);
  });

  it("never includes another account's rows", () => {
    const rows = [
      inv({ id: "a1", userId: "acct-A", clientName: "Mine" }),
      inv({ id: "z1", userId: "acct-B", clientId: "z", clientName: "Foreign", issueDate: "2026-11-01" }),
    ];
    const out = buildPartnerSuggestions(rows, [line("z1")], opts);
    expect(out.map((s) => s.partner.name)).toEqual(["Mine"]);
  });

  it("ignores drafts, proformas and stornos", () => {
    const rows = [
      inv({ id: "d", status: "draft", clientName: "Draft" }),
      inv({ id: "p", documentType: "proforma", clientName: "Pro" }),
      inv({ id: "s", documentType: "storno", clientName: "Storno" }),
    ];
    expect(buildPartnerSuggestions(rows, [], opts)).toEqual([]);
  });

  it("matches name accent-insensitively and tax number by digits", () => {
    const rows = [
      inv({ id: "1", clientId: "c1", clientName: "Kovács Bt.", clientTaxNumber: "11111111-2-13" }),
      inv({ id: "2", clientId: "c2", clientName: "Nagy Kft.", clientTaxNumber: "22222222-2-13" }),
    ];
    expect(buildPartnerSuggestions(rows, [], { ...opts, query: "kovacs" }).map((s) => s.partner.name)).toEqual([
      "Kovács Bt.",
    ]);
    expect(buildPartnerSuggestions(rows, [], { ...opts, query: "2222" }).map((s) => s.partner.name)).toEqual([
      "Nagy Kft.",
    ]);
  });

  it("caps the list at the limit", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      inv({ id: `i${i}`, clientId: `c${i}`, clientName: `P${i}`, issueDate: `2026-10-${String(i + 1).padStart(2, "0")}` })
    );
    expect(buildPartnerSuggestions(rows, [], { ...opts, limit: 5 })).toHaveLength(5);
  });

  it("derives usual settings from the most recent issued invoice only", () => {
    const rows = [
      inv({ id: "old", issueDate: "2026-08-01", dueDate: "2026-08-31", currency: "HUF" }),
      inv({
        id: "new",
        issueDate: "2026-10-01",
        dueDate: "2026-10-16",
        currency: "EUR",
        language: "en",
        paymentMethod: "transfer",
      }),
    ];
    const [s] = buildPartnerSuggestions(rows, [line("new"), line("old", { description: "Régi" })], opts);
    expect(s.usual).toMatchObject({
      currency: "EUR",
      language: "en",
      paymentMethod: "transfer",
      paymentTermDays: 15,
      vat: { category: "normal", rate: 27 },
    });
    expect(s.usual.lineItems).toEqual([
      { description: "Munka", quantity: 2, unit: "óra", unitPrice: 100, vatRate: 27, vatCategory: "normal" },
    ]);
    expect(JSON.stringify(s.usual)).not.toContain("2026-");
  });

  it("omits the VAT treatment when lines disagree, and unknown enums", () => {
    const rows = [inv({ id: "n", language: "xx", paymentMethod: "bitcoin" })];
    const [s] = buildPartnerSuggestions(
      rows,
      [line("n"), line("n", { vatRate: 0, vatCategory: "AAM", sortOrder: 1 })],
      opts
    );
    expect(s.usual.vat).toBeUndefined();
    expect(s.usual.language).toBeUndefined();
    expect(s.usual.paymentMethod).toBeUndefined();
  });

  it("uses the linked client row when present, else the invoice snapshot", () => {
    const rows = [
      inv({ id: "1", clientId: "c1", clientName: "Old Name" }),
      inv({ id: "2", clientId: null, clientName: "Local Bt.", clientTaxNumber: "99999999-1-11", clientCity: "Pécs" }),
    ];
    const clients = [
      { id: "c1", userId: "acct-A", name: "Acme Kft.", email: "a@x.hu", createdAt: "", updatedAt: "" },
      { id: "c9", userId: "acct-B", name: "Foreign", createdAt: "", updatedAt: "" },
    ];
    const out = buildPartnerSuggestions(rows, [], { ...opts, clients });
    const acme = out.find((s) => s.partner.clientId === "c1")!;
    expect(acme.partner).toMatchObject({ name: "Acme Kft.", email: "a@x.hu" });
    const local = out.find((s) => s.partner.clientId === null)!;
    expect(local.partner).toMatchObject({ name: "Local Bt.", city: "Pécs", taxNumber: "99999999-1-11" });
  });
});
