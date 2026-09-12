// lib/bank-matching/normalize.test.ts
import {
  compactRemittance,
  normalizeInvoiceNumber,
  normalizePartyName,
  stripDiacritics,
} from "@/lib/bank-matching/normalize";

describe("stripDiacritics", () => {
  it("removes Hungarian accents", () => {
    expect(stripDiacritics("Árvíztűrő tükörfúrógép")).toBe(
      "Arvizturo tukorfurogep",
    );
  });
});

describe("normalizePartyName", () => {
  it("normalizes accents, case, and company suffixes", () => {
    expect(normalizePartyName("Kovács Éva Kft.")).toBe("kovacs eva");
    expect(normalizePartyName("KOVACS EVA kft")).toBe("kovacs eva");
  });

  it("collapses punctuation and whitespace", () => {
    expect(normalizePartyName("  Acme   —  Bt.  ")).toBe("acme");
  });
});

describe("compactRemittance / invoice number", () => {
  it("extracts comparable invoice tokens", () => {
    expect(normalizeInvoiceNumber("IH-2026/0042")).toBe("IH20260042");
    expect(compactRemittance("Közlemény: IH-2026/0042 köszönöm")).toContain(
      "IH20260042",
    );
  });
});
