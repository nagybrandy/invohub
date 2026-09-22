// lib/invoices/document-labels.test.ts
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";
import {
  documentLabels,
  documentStatusChip,
  documentTitleFor,
  formatDocumentAmount,
  formatDocumentQuantity,
  formatPartyAddress,
  isWinAnsiSafe,
  toWinAnsiSafe,
} from "@/lib/invoices/document-labels";

describe("documentLabels", () => {
  it("defaults to the Hungarian label set — the outgoing document does not follow app UI language", () => {
    const labels = documentLabels();
    expect(labels.buyer).toBe(hu.invoices.document.buyer);
    expect(labels.seller).toBe(hu.invoices.document.seller);
  });

  it('resolves the English set for documentLabels("en")', () => {
    const labels = documentLabels("en");
    expect(labels.buyer).toBe(en.invoices.document.buyer);
    expect(labels.seller).toBe(en.invoices.document.seller);
  });

  it("reads every label from the locale modules, not an inline duplicate", () => {
    expect(documentLabels().buyer).toBe(hu.invoices.document.buyer);
    expect(documentLabels().netTotal).toBe(hu.invoices.document.netTotal);
    expect(documentLabels().draftNumber).toBe(hu.invoices.document.draftNumber);
    expect(documentLabels().footer).toBe(hu.invoices.document.footer);
  });
});

describe("documentTitleFor", () => {
  it("maps documentType to the Hungarian document title by default", () => {
    expect(documentTitleFor("invoice")).toBe(hu.invoices.documentTypes.invoice);
    expect(documentTitleFor("proforma")).toBe(hu.invoices.documentTypes.proforma);
    expect(documentTitleFor("storno")).toBe(hu.invoices.documentTypes.storno);
    expect(documentTitleFor("modify")).toBe(hu.invoices.documentTypes.modify);
    expect(documentTitleFor("proforma")).toBe("Díjbekérő");
    expect(documentTitleFor("storno")).toBe("Sztornó számla");
    expect(documentTitleFor("modify")).toBe("Helyesbítő számla");
  });
});

describe("documentStatusChip", () => {
  it("prints a chip only for statuses that change what the document is", () => {
    expect(documentStatusChip("draft")).toBe(hu.invoices.status.draft);
    expect(documentStatusChip("paid")).toBe(hu.invoices.status.paid);
    expect(documentStatusChip("cancelled")).toBe(hu.invoices.status.cancelled);
  });

  it("prints no chip for app-bookkeeping-only statuses", () => {
    expect(documentStatusChip("sent")).toBeNull();
    expect(documentStatusChip("unpaid")).toBeNull();
    expect(documentStatusChip("overdue")).toBeNull();
    expect(documentStatusChip("partially_paid")).toBeNull();
  });
});

describe("formatDocumentAmount", () => {
  it("formats HUF with narrow no-break-space thousands groups and no decimals", () => {
    expect(formatDocumentAmount(1234567, "HUF")).toBe("1 234 567 Ft");
  });

  it("formats EUR with hu-HU decimal comma and a space before the symbol, independent of server locale", () => {
    expect(formatDocumentAmount(1234.5, "EUR")).toBe("1 234,50 €");
  });
});

describe("toWinAnsiSafe / isWinAnsiSafe", () => {
  it("transliterates ő/ű (and uppercase) to ö/ü, leaving everything else unchanged", () => {
    expect(toWinAnsiSafe("Vevő űrlap ŐSZ ŰR")).toBe("Vevö ürlap ÖSZ ÜR");
  });

  it("isWinAnsiSafe is true for text with no ő/ű", () => {
    expect(isWinAnsiSafe("Fordított adózás")).toBe(true);
  });

  it("isWinAnsiSafe is false for text containing ő/ű", () => {
    expect(isWinAnsiSafe("Kőfaragó Kft.")).toBe(false);
    expect(isWinAnsiSafe("Tetőfelújítás")).toBe(false);
  });
});

describe("formatPartyAddress", () => {
  it("prints postcode + city first, then the street, and drops a domestic country", () => {
    expect(
      formatPartyAddress({ zipCode: "1114", city: "Budapest", address: "Bartók Béla út 42.", country: "Magyarország" })
    ).toBe("1114 Budapest, Bartók Béla út 42.");
  });

  it("appends a foreign country", () => {
    expect(formatPartyAddress({ zipCode: "1010", city: "Wien", address: "Ring 1", country: "Österreich" })).toBe(
      "1010 Wien, Ring 1, Österreich"
    );
  });

  it("returns an empty string when nothing is set", () => {
    expect(formatPartyAddress({})).toBe("");
  });
});

describe("formatDocumentQuantity", () => {
  it("uses a Hungarian decimal comma", () => {
    expect(formatDocumentQuantity(1.5)).toBe("1,5");
  });

  it("appends the unit when present", () => {
    expect(formatDocumentQuantity(24, "óra")).toBe("24 óra");
  });

  it("prints a bare integer without a unit", () => {
    expect(formatDocumentQuantity(3)).toBe("3");
  });
});
