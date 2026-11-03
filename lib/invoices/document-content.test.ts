// lib/invoices/document-content.test.ts
import { buildDocumentContent } from "@/lib/invoices/document-content";
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const COMPANY = {
  name: "Kovács Anna e.v.",
  taxNumber: "66123456-1-33",
  address: "Bartók Béla út 21. 2/4.",
  city: "Budapest",
  zipCode: "1114",
  bankAccount: "11773016-11111018-00000000",
};
const BUYER = { address: "Minta utca 12.", city: "Budapest", zipCode: "1117" };

function content(
  invoiceOverrides: Parameters<typeof makeInvoice>[0] = {},
  extra: Partial<InvoicePdfContext> = {},
  options?: Parameters<typeof buildDocumentContent>[1]
) {
  return buildDocumentContent(
    { invoice: makeInvoice(invoiceOverrides), company: COMPANY, buyer: BUYER, template: DEFAULT_PDF_TEMPLATE, ...extra },
    options
  );
}

describe("buildDocumentContent", () => {
  it("prints title, number, issuer identity and the six column labels", () => {
    const c = content();
    expect(c.title).toBe("SZÁMLA");
    expect(c.number).toBe("INV-2026-001");
    expect(c.issuer).toEqual({
      name: "Kovács Anna e.v.",
      address: "1114 Budapest, Bartók Béla út 21. 2/4.",
      taxNumber: "Adószám: 66123456-1-33",
    });
    expect(c.columnLabels).toEqual(["Megnevezés", "Mennyiség", "Egységár", "Nettó", "ÁFA", "Bruttó"]);
  });

  it("uses the document type's own title, never the template title, for a non-invoice", () => {
    expect(content({ documentType: "proforma" }).title).toBe("DÍJBEKÉRŐ");
    expect(content({ documentType: "advance" }).title).toBe("ELŐLEGSZÁMLA");
    expect(content({ documentType: "storno" }).title).toBe("SZTORNÓ SZÁMLA");
    expect(content({ documentType: "modify" }).title).toBe("HELYESBÍTŐ SZÁMLA");
  });

  it("references the corrected invoice on a storno / helyesbítő", () => {
    expect(content({ documentType: "storno" }, { referencedInvoiceNumber: "INV-1" }).referenceText).toBe(
      "Az INV-1 sorszámú számla sztornója"
    );
    expect(content({ documentType: "modify" }, { referencedInvoiceNumber: "INV-1" }).referenceText).toBe(
      "Az INV-1 sorszámú számla helyesbítése"
    );
    expect(content({ documentType: "invoice" }, { referencedInvoiceNumber: "INV-1" }).referenceText).toBeNull();
    expect(content({ documentType: "storno" }).referenceText).toBeNull();
  });

  it("marks an unnumbered draft and prints the draft label as its number", () => {
    const draft = content({ invoiceNumber: "", status: "draft" });
    expect(draft.isUnnumberedDraft).toBe(true);
    expect(draft.number).toBe("Piszkozat");
    expect(draft.continuationBanner).toBe("Piszkozat · folytatás");
    expect(draft.statusChip).toBe("Piszkozat");
    expect(content().isUnnumberedDraft).toBe(false);
  });

  it("prints Teljesítés kelte only when a fulfillment date is resolved, and Árfolyam only for a non-HUF currency", () => {
    expect(content().metaCells.map((c) => c.label)).toEqual(["Kiállítás kelte", "Fizetési határidő", "Pénznem"]);
    const eur = content({ currency: "EUR", exchangeRate: 395.5, fulfillmentDate: "2026-06-01", paymentMethod: "transfer" });
    expect(eur.metaCells.map((c) => c.label)).toEqual([
      "Kiállítás kelte",
      "Teljesítés kelte",
      "Fizetési határidő",
      "Fizetési mód",
      "Pénznem",
      "Árfolyam",
    ]);
    expect(eur.metaCells.at(-1)!.value).toBe("1 EUR = 395,5 HUF");
    expect(eur.totalsRows.map((r) => r.label)).toEqual(["Nettó összesen", "ÁFA összesen", "ÁFA összege forintban"]);
  });

  it("formats rows like the legacy renderer (quantity + unit, VAT cell as rate or category)", () => {
    const c = content({
      lineItems: [
        makeLineItem({ description: "Webfejlesztés", quantity: 24, unit: "óra", unitPrice: 15000 }),
        makeLineItem({ id: "2", description: "AAM tétel", vatCategory: "AAM", vatRate: 0, comment: "  megjegyzés " }),
      ],
    });
    expect(c.rows[0]).toMatchObject({ description: "Webfejlesztés", quantity: "24 óra", vat: "27%" });
    expect(c.rows[1]).toMatchObject({ vat: "AAM", note: "megjegyzés" });
    expect(c.exemptionReasons).toHaveLength(1);
    expect(c.exemptionReasons[0]).toMatch(/\S/);
  });

  describe("toggles", () => {
    it("showCompanyBlock off hides only the Kibocsátó box; the header issuer identity stays", () => {
      const c = content({}, { template: { ...DEFAULT_PDF_TEMPLATE, showCompanyBlock: false } });
      expect(c.seller).toBeNull();
      expect(c.issuer).toMatchObject({ name: "Kovács Anna e.v.", taxNumber: "Adószám: 66123456-1-33" });
      expect(c.issuer!.address).toContain("Bartók Béla út 21. 2/4.");
    });

    it("showBankDetails off hides the bank account in the seller box and in the strip", () => {
      const on = content();
      expect(on.seller!.lines.join("|")).toContain("Bankszámlaszám: 11773016-11111018-00000000");
      expect(on.payment!.cells.map((c) => c.label)).toEqual(["Bankszámlaszám", "Közlemény", "Fizetési határidő"]);

      const off = content({}, { template: { ...DEFAULT_PDF_TEMPLATE, showBankDetails: false } });
      expect(off.seller!.lines.join("|")).not.toContain("Bankszámlaszám");
      expect(off.payment!.cells.map((c) => c.label)).toEqual(["Fizetési határidő"]);
    });

    it("showClientTaxNumber off still prints the buyer tax number when the paper layouts ask for it", () => {
      const template = { ...DEFAULT_PDF_TEMPLATE, showClientTaxNumber: false };
      expect(content({}, { template }, { alwaysPrintBuyerTaxNumber: true }).buyer.lines.join("|")).toContain(
        "Adószám: 12345678-1-23"
      );
      expect(content({}, { template }).buyer.lines.join("|")).not.toContain("Adószám");
    });

    it("never prints a buyer tax number the invoice does not carry", () => {
      expect(
        content({ clientTaxNumber: undefined }, {}, { alwaysPrintBuyerTaxNumber: true }).buyer.lines.join("|")
      ).not.toContain("Adószám");
    });
  });

  describe("payment strip", () => {
    it("is absent for cash, and for a refund", () => {
      expect(content({ paymentMethod: "cash" }).payment).toBeNull();
      expect(content({ lineItems: [makeLineItem({ quantity: -1 })] }).payment).toBeNull();
    });

    it("omits Közlemény on an unnumbered draft", () => {
      const draft = content({ invoiceNumber: "", status: "draft" });
      expect(draft.payment!.cells.map((c) => c.label)).toEqual(["Bankszámlaszám", "Fizetési határidő"]);
    });

    it("is the single due-date cell without a bank account", () => {
      const c = content({}, { company: { ...COMPANY, bankAccount: undefined } });
      expect(c.payment!.cells.map((c2) => c2.label)).toEqual(["Fizetési határidő"]);
    });
  });

  it("labels a net-negative document as a refund", () => {
    const c = content({ lineItems: [makeLineItem({ quantity: -2, unitPrice: 100 })] });
    expect(c.due).toMatchObject({ label: "Visszatérítendő összeg", isRefund: true });
    expect(content().due).toMatchObject({ label: "Fizetendő összesen", isRefund: false });
  });

  it("localizes the default template texts and every label for an English invoice", () => {
    const c = content({ language: "en" });
    expect(c.title).toBe("INVOICE");
    expect(c.footerText).toBe("Thank you for your business!");
    expect(c.notesLabel).toBe("Note");
    expect(c.columnLabels[0]).toBe("Description");
    expect(c.pageIndicator(2, 3)).toBe("Page 2 of 3");
  });

  it("legacy-default footer texts are compared against the legacy set", () => {
    expect(content({ language: "en" }, { template: LEGACY_PDF_TEMPLATE }).footerText).toBe("Thank you for your business!");
  });

  it("builds the VAT summary per rate", () => {
    const c = content({
      lineItems: [
        makeLineItem({ id: "a", quantity: 1, unitPrice: 1000, vatRate: 27 }),
        makeLineItem({ id: "b", quantity: 1, unitPrice: 1000, vatRate: 5 }),
      ],
    });
    expect(c.vatSummary.header).toEqual(["ÁFA-kulcs", "Nettó", "ÁFA összeg", "Bruttó"]);
    expect(c.vatSummary.rows).toHaveLength(2);
  });

  it("omits the issuer identity only when the company has no name", () => {
    expect(content({}, { company: undefined }).issuer).toBeNull();
    expect(content({}, { company: undefined }).seller).toBeNull();
  });
});
