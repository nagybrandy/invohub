// lib/invoices/generate-pdf.test.ts
let mockDrawnTexts: string[] = [];
let mockFontCalls: string[] = [];

jest.mock("@/lib/invoices/pdf-document", () => {
  const { EventEmitter } = require("events");

  class MockPDFDocument extends EventEmitter {
    page = {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    };
    y = 100;
    _registeredFonts: Record<string, boolean> = {};

    currentLineHeight() {
      return 12;
    }
    heightOfString(text: string) {
      return Math.max(12, Math.ceil(String(text).length / 40) * 12);
    }
    widthOfString(text: string) {
      return String(text).length * 6;
    }
    fontSize() {
      return this;
    }
    // Records every font name generate-pdf.ts / pdf-layout.ts asks for
    // (AC7's font-name audit) — mirrors pdfkit's own doc.font(name) shape.
    font(name?: string) {
      if (name) mockFontCalls.push(name);
      return this;
    }
    // Mirrors pdfkit's doc.registerFont(name, path) — records the name so
    // documentFontNames(doc) (a real, unmocked lib/invoices/pdf-fonts.ts
    // function) can read it back via _registeredFonts, same as it would on
    // a real pdfkit document.
    registerFont(name: string) {
      this._registeredFonts[name] = true;
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

  // pdf-fonts.ts imports collectSearchRoots from this same module — keep
  // the real implementation so resolvePdfFontFiles() can find the actual
  // committed assets/fonts/pdf/*.ttf files on disk (the embedded-path
  // tests below rely on that, same as a real request would).
  const actual = jest.requireActual("@/lib/invoices/pdf-document");

  return {
    createPdfDocument: () => new MockPDFDocument(),
    withPdfKitFonts: (run: () => unknown) => run(),
    collectSearchRoots: actual.collectSearchRoots,
  };
});

import { generateInvoicePdf, invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import { formatDocumentAmount, isWinAnsiSafe } from "@/lib/invoices/document-labels";
import * as pdfFontsModule from "@/lib/invoices/pdf-fonts";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

beforeEach(() => {
  mockDrawnTexts = [];
  mockFontCalls = [];
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

  it("draws the Hungarian document labels unmodified — no transliteration on the embedded path (AC4/AC5)", async () => {
    const invoice = makeInvoice({ status: "sent" });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    // The font files are actually present on disk in this repo/worktree
    // (assets/fonts/pdf/), so pdf-fonts.ts is not mocked here and
    // registerDocumentFonts finds them for real — this exercises the
    // embedded path, where doc.text is NOT wrapped with toWinAnsiSafe (AC5)
    // and ő/ű reach doc.text exactly as typed (AC4).
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
      expect(mockDrawnTexts.some((t) => t.includes(label))).toBe(true);
    }

    // No transliterated forms should appear at all on the embedded path.
    for (const transliterated of ["Vevö", "Fizetési határidö"]) {
      expect(mockDrawnTexts.some((t) => t.includes(transliterated))).toBe(false);
    }

    for (const stale of ["Bill to", "Description", "Qty", "Subtotal", "Status: sent"]) {
      expect(mockDrawnTexts.some((t) => t.includes(stale))).toBe(false);
    }
  });

  it("draws Hungarian client/line-item text unmodified on the embedded path (AC4)", async () => {
    const invoice = makeInvoice({
      clientName: "Kőfaragó Kft.",
      lineItems: [makeLineItem({ description: "Tetőfelújítás" })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain("Kőfaragó Kft.");
    expect(mockDrawnTexts).toContain("Tetőfelújítás");
    expect(mockDrawnTexts).not.toContain("Köfaragó Kft.");
    expect(mockDrawnTexts).not.toContain("Tetöfelújítás");
  });

  it("uses only the two embedded font names, never a hard-coded Helvetica, on the embedded path (AC7)", async () => {
    const invoice = makeInvoice({
      lineItems: [
        makeLineItem({ vatCategory: "AAM", vatRate: 0 }),
        makeLineItem({ id: "l2", description: "Second line" }),
      ],
      notes: "Some notes",
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft.", logoUrl: undefined } });

    expect(mockFontCalls.length).toBeGreaterThan(0);
    const allowed = new Set([pdfFontsModule.PDF_FONT_REGULAR, pdfFontsModule.PDF_FONT_BOLD]);
    for (const name of mockFontCalls) {
      expect(allowed.has(name)).toBe(true);
    }
    expect(mockFontCalls).not.toContain("Helvetica");
    expect(mockFontCalls).not.toContain("Helvetica-Bold");
  });

  describe("fallback path (font files unresolvable)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("keeps the old transliteration behaviour and logs a single explicit console.error (AC6)", async () => {
      jest.spyOn(pdfFontsModule, "registerDocumentFonts").mockReturnValue({
        embedded: false,
        regular: pdfFontsModule.FALLBACK_FONT_REGULAR,
        bold: pdfFontsModule.FALLBACK_FONT_BOLD,
      });
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const invoice = makeInvoice({
        clientName: "Kőfaragó Kft.",
        lineItems: [makeLineItem({ description: "Tetőfelújítás" })],
      });

      const pdf = await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

      // Still renders, never throws.
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.toString("utf8")).toContain("%PDF-");

      expect(mockDrawnTexts).toContain("Köfaragó Kft.");
      expect(mockDrawnTexts).toContain("Tetöfelújítás");
      expect(mockDrawnTexts.every((t) => isWinAnsiSafe(t))).toBe(true);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [message] = errorSpy.mock.calls[0] ?? [];
      expect(String(message)).toEqual(expect.stringContaining("falling back to ő→ö / ű→ü transliteration"));
    });

    it("uses only the Helvetica fallback names, never the embedded names", async () => {
      jest.spyOn(pdfFontsModule, "registerDocumentFonts").mockReturnValue({
        embedded: false,
        regular: pdfFontsModule.FALLBACK_FONT_REGULAR,
        bold: pdfFontsModule.FALLBACK_FONT_BOLD,
      });
      jest.spyOn(console, "error").mockImplementation(() => {});

      const invoice = makeInvoice({ status: "sent" });
      await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

      expect(mockFontCalls.length).toBeGreaterThan(0);
      for (const name of mockFontCalls) {
        expect(["Helvetica", "Helvetica-Bold"]).toContain(name);
      }
    });
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
