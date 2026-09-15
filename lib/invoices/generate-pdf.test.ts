// lib/invoices/generate-pdf.test.ts
let mockDrawnTexts: string[] = [];

jest.mock("@/lib/invoices/pdf-document", () => {
  const { EventEmitter } = require("events");

  class MockPDFDocument extends EventEmitter {
    page = {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    };
    y = 100;

    currentLineHeight() {
      return 12;
    }
    heightOfString(text: string) {
      return Math.max(12, Math.ceil(String(text).length / 40) * 12);
    }
    fontSize() {
      return this;
    }
    font() {
      return this;
    }
    fillColor() {
      return this;
    }
    fill() {
      return this;
    }
    text(value: string) {
      mockDrawnTexts.push(value);
      return this;
    }
    save() {
      return this;
    }
    restore() {
      return this;
    }
    roundedRect() {
      return this;
    }
    lineWidth() {
      return this;
    }
    image() {
      return this;
    }
    moveDown() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    strokeColor() {
      return this;
    }
    stroke() {
      return this;
    }
    addPage() {
      return this;
    }
    end() {
      this.emit("data", Buffer.from("%PDF-1.4\n"));
      this.emit("end");
    }
  }

  return {
    createPdfDocument: () => new MockPDFDocument(),
    withPdfKitFonts: (run: () => unknown) => run(),
  };
});

import { generateInvoicePdf, invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import {
  formatDocumentAmount,
  isWinAnsiSafe,
  toWinAnsiSafe,
} from "@/lib/invoices/document-labels";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

beforeEach(() => {
  mockDrawnTexts = [];
});

describe("invoicePdfFilename", () => {
  it("sanitizes unsafe characters", () => {
    expect(invoicePdfFilename("INV/2026#001")).toBe("INV_2026_001.pdf");
  });

  it("falls back to DRAFT.pdf for an unfinalized invoice (blank number)", () => {
    expect(invoicePdfFilename("")).toBe("DRAFT.pdf");
  });
});

describe("generateInvoicePdf", () => {
  it("returns a PDF buffer from the document stream", async () => {
    const invoice = makeInvoice({
      lineItems: [makeLineItem({ description: "Consulting", quantity: 2, unitPrice: 100 })],
    });

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
      template: { titleText: "CUSTOM INVOICE", accentColor: "#ff0000" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.toString("utf8")).toContain("%PDF-");
  });

  it("prints the VAT category instead of a percentage, and the exemption reason once", async () => {
    const invoice = makeInvoice({
      lineItems: [
        makeLineItem({ id: "l1", vatCategory: "AAM", vatRate: 0 }),
        makeLineItem({ id: "l2", description: "Second exempt line", vatCategory: "AAM", vatRate: 0 }),
      ],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain("AAM");
    expect(mockDrawnTexts.filter((t) => t === "Alanyi adómentes")).toHaveLength(1);
  });

  it("prints a custom exemption reason override when set", async () => {
    const invoice = makeInvoice({
      lineItems: [
        makeLineItem({ vatCategory: "FAD", vatRate: 0, vatExemptionReason: "Custom FAD reason" }),
      ],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain("Custom FAD reason");
    expect(mockDrawnTexts).not.toContain("Fordított adózás");
  });

  it("prints no exemption note block for an ordinary taxed invoice", async () => {
    const invoice = makeInvoice({
      lineItems: [makeLineItem({ vatCategory: "normal", vatRate: 27 })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).not.toContain("Alanyi adómentes");
  });

  it("draws the Hungarian document labels and none of the old English chrome", async () => {
    const invoice = makeInvoice({ status: "sent" });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    // Every string drawn into the PDF — labels included — is routed through
    // toWinAnsiSafe (AC16), so a label containing ő/ű (Vevő, ... határidő)
    // is asserted here in its transliterated form (Vevö, ... határidö),
    // same as any other drawn text.
    for (const label of [
      "Kibocsátó",
      "Vevő",
      "Megnevezés",
      "Mennyiség",
      "Egységár",
      "ÁFA",
      "Bruttó",
      "Fizetési határidő",
    ]) {
      const expected = toWinAnsiSafe(label);
      expect(mockDrawnTexts.some((t) => t.includes(expected))).toBe(true);
    }

    for (const stale of ["Bill to", "Description", "Qty", "Subtotal", "Status: sent"]) {
      expect(mockDrawnTexts.some((t) => t.includes(stale))).toBe(false);
    }
  });

  it("transliterates ő/ű everywhere so every drawn string is WinAnsi-safe", async () => {
    const invoice = makeInvoice({
      clientName: "Kőfaragó Kft.",
      lineItems: [makeLineItem({ description: "Tetőfelújítás" })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain("Köfaragó Kft.");
    expect(mockDrawnTexts).toContain("Tetöfelújítás");
    expect(mockDrawnTexts.every((t) => isWinAnsiSafe(t))).toBe(true);
  });

  it("draws amounts with Hungarian grouping via formatDocumentAmount", async () => {
    const invoice = makeInvoice({
      currency: "HUF",
      lineItems: [makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain(formatDocumentAmount(254, "HUF"));
  });

  // AC15: not the plan's literal English wording — the branding slice
  // (slice/hungarianize-brand-invoice-preview-pdf, merged first) routes this
  // line through the Hungarian document-labels vocabulary like every other
  // label on the document, so it reads "ÁFA összege forintban:" instead of
  // "VAT amount in HUF:".
  it("draws the forint VAT line for a EUR invoice (AC15)", async () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 390.5,
      lineItems: [makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts.some((t) => t.includes("ÁFA összege forintban"))).toBe(true);
    // net 200 * vatRate 27% = 54 EUR VAT, converted at 390.5 -> 21087 HUF.
    expect(mockDrawnTexts).toContain(formatDocumentAmount(21087, "HUF"));
  });

  it("does not draw a forint VAT line for a HUF invoice (AC15)", async () => {
    const invoice = makeInvoice({ currency: "HUF" });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts.some((t) => t.includes("ÁFA összege forintban"))).toBe(false);
  });
});
