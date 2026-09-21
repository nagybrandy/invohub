// lib/invoices/generate-pdf.test.ts
let mockDrawnTexts: string[] = [];
let mockFontCalls: string[] = [];
let mockTextCalls: Array<{ text: string; x: number; y: number; width?: number; align?: string }> = [];
let mockFillColorCalls: string[] = [];
let mockSwitchToPageCalls: number[] = [];
let mockBufferedPageRange: { start: number; count: number } = { start: 0, count: 1 };
// AC4/AC6/AC9/AC13/AC15: records every filled rect/roundedRect — the fill
// colour a `.roundedRect(x,y,w,h,r).fill(color)` / `.rect(x,y,w,h).fill(color)`
// chain actually painted, and the geometry, so tests can assert band/panel/
// card/chip fills and positions without needing pixel output.
let mockRectCalls: Array<{ x: number; y: number; width: number; height: number; radius?: number; fill?: string }> = [];
let mockLastShape: { x: number; y: number; width: number; height: number; radius?: number } | null = null;
// AC2: records the `options` object every `createPdfDocument(options)` call
// received, so a test can assert generateInvoicePdf creates its document
// with `margins: { ..., bottom: CONTENT_MARGIN_BOTTOM }` instead of the old
// `margin: 48` shorthand.
let mockConstructorOptions: Array<Record<string, unknown> | undefined> = [];
// Plan: docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md §4.2 —
// every MockPDFDocument instance createPdfDocument() hands back, so a test
// can assert `listenerCount("pageAdded")` is 0 after generation (AC6, no
// leaked notes-continuation listener). Typed structurally (not as
// MockPDFDocument, which is declared inside the jest.mock factory below and
// so isn't a type this outer scope can name) — every value pushed onto it
// really is a MockPDFDocument, which extends EventEmitter.
let mockDocs: Array<{ listenerCount(event: string): number }> = [];

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

    constructor(options?: Record<string, unknown>) {
      super();
      mockConstructorOptions.push(options);
      const margins = options?.margins as
        | { left: number; right: number; top: number; bottom: number }
        | undefined;
      if (margins) {
        this.page.margins = { ...margins };
      }
    }

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
    fillColor(color?: string) {
      if (color) mockFillColorCalls.push(color);
      return this;
    }
    fill(color?: string) {
      if (mockLastShape) {
        mockRectCalls.push({ ...mockLastShape, fill: color });
      }
      return this;
    }
    text(value: string, x?: number, y?: number, opts?: { width?: number; align?: string }) {
      mockDrawnTexts.push(value);
      if (typeof x === "number" && typeof y === "number") {
        mockTextCalls.push({ text: value, x, y, width: opts?.width, align: opts?.align });
      }
      return this;
    }
    save() {
      return this;
    }
    restore() {
      return this;
    }
    roundedRect(x: number, y: number, width: number, height: number, radius?: number) {
      mockLastShape = { x, y, width, height, radius };
      return this;
    }
    rect(x: number, y: number, width: number, height: number) {
      mockLastShape = { x, y, width, height };
      return this;
    }
    lineWidth() {
      return this;
    }
    lineCap() {
      return this;
    }
    lineJoin() {
      return this;
    }
    path() {
      return this;
    }
    circle() {
      return this;
    }
    translate() {
      return this;
    }
    scale() {
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
    bufferedPageRange() {
      return mockBufferedPageRange;
    }
    switchToPage(index: number) {
      mockSwitchToPageCalls.push(index);
      return this;
    }
    flushPages() {
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
    createPdfDocument: (options?: Record<string, unknown>) => {
      const doc = new MockPDFDocument(options);
      mockDocs.push(doc);
      return doc;
    },
    withPdfKitFonts: (run: () => unknown) => run(),
    collectSearchRoots: actual.collectSearchRoots,
  };
});

import { generateInvoicePdf, invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import { documentLabels, formatDocumentAmount, isWinAnsiSafe } from "@/lib/invoices/document-labels";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import { documentInk } from "@/lib/invoices/document-ink";
import { landingColors } from "@/components/marketing/landing-theme";
import * as pdfFontsModule from "@/lib/invoices/pdf-fonts";
import { CONTENT_MARGIN_BOTTOM, PAGE_MARGIN, readableTextOn, tint } from "@/lib/invoices/pdf-layout";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

beforeEach(() => {
  mockDrawnTexts = [];
  mockFontCalls = [];
  mockTextCalls = [];
  mockFillColorCalls = [];
  mockSwitchToPageCalls = [];
  mockBufferedPageRange = { start: 0, count: 1 };
  mockConstructorOptions = [];
  mockRectCalls = [];
  mockLastShape = null;
  mockDocs = [];
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
    // and ő/ű reach doc.text exactly as typed (AC4). Kibocsátó/Vevő are
    // drawn as party-card titles, which this slice deliberately uppercases
    // (AC6, mirroring preview-html.ts's `.party-card h2 { text-transform:
    // uppercase }`) — checked case-insensitively so the ő/ű glyphs
    // themselves are still asserted unmangled either way.
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
      expect(mockDrawnTexts.some((t) => t.toLocaleUpperCase("hu").includes(label.toLocaleUpperCase("hu")))).toBe(
        true
      );
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

describe("generateInvoicePdf — InvoHub footer brand mark", () => {
  it("draws the InvoHub attribution text from documentLabels(), not a hard-coded string (AC1)", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain(documentLabels().footer);
  });

  it("still draws the issuer's own template.footerText in the same band (AC6)", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts).toContain(DEFAULT_PDF_TEMPLATE.footerText);
    expect(mockDrawnTexts).toContain(documentLabels().footer);
  });

  it("draws the footer strip on every buffered page (AC7)", async () => {
    mockBufferedPageRange = { start: 0, count: 2 };
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockSwitchToPageCalls).toEqual([0, 1]);
    const attributionCount = mockDrawnTexts.filter((t) => t === documentLabels().footer).length;
    expect(attributionCount).toBe(2);
  });

  it("never draws the footer band below the bottom margin (AC8)", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    const labels = documentLabels();
    const footerDraws = mockTextCalls.filter(
      (call) => call.text === labels.footer || call.text === DEFAULT_PDF_TEMPLATE.footerText
    );
    expect(footerDraws.length).toBeGreaterThan(0);

    // page.margins.bottom is back at its original value by the time the
    // draw pass returns (the per-page zero-out is scoped to the draw).
    const bottomLimit = 841.89 - 48;
    for (const draw of footerDraws) {
      expect(draw.y).toBeLessThanOrEqual(bottomLimit);
    }
  });

  it("draws the mark in landingColors.navy / landingColors.cornflower, never a raw hex literal from generate-pdf.ts (AC3)", async () => {
    // A distinct accentColor so the header/table's own accent fills can't
    // be mistaken for the brand mark's flow ink (the template default,
    // #6495ed, happens to equal landingColors.cornflower).
    const invoice = makeInvoice();

    await generateInvoicePdf({
      invoice,
      company: { name: "Demo Kft." },
      template: { accentColor: "#ff0000" },
    });

    expect(mockFillColorCalls).toContain(landingColors.navy);
    expect(mockFillColorCalls).toContain(landingColors.cornflower);
  });

  it("draws the footer strip's own footerText and page indicator in documentInk.muted, never the old #666666 (AC11)", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({
      invoice,
      company: { name: "Demo Kft." },
      template: { footerText: "Köszönjük a vásárlást" },
    });

    expect(mockFillColorCalls).not.toContain("#666666");
    expect(mockFillColorCalls).toContain(documentInk.muted);
  });
});

describe("generateInvoicePdf — document geometry (AC2)", () => {
  it("creates the document with margins.bottom === CONTENT_MARGIN_BOTTOM, not margin: 48", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(CONTENT_MARGIN_BOTTOM).toBe(84);
    expect(mockConstructorOptions).toHaveLength(1);
    const options = mockConstructorOptions[0];
    expect(options?.margin).toBeUndefined();
    expect(options?.margins).toEqual({
      top: PAGE_MARGIN,
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      bottom: CONTENT_MARGIN_BOTTOM,
    });
  });
});

describe("generateInvoicePdf — footer page indicator (AC12)", () => {
  it("draws no page indicator when there is exactly 1 buffered page", async () => {
    mockBufferedPageRange = { start: 0, count: 1 };
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts.some((t) => /\d+\/\d+\.\s*oldal/.test(t))).toBe(false);
    // Existing empty-footerText behaviour (lockup centred) is unchanged —
    // the issuer footerText is set by default here so this only guards the
    // indicator itself; the centred-lockup case is covered elsewhere.
  });

  it("draws '1/3. oldal', '2/3. oldal' and '3/3. oldal' exactly once each with 3 buffered pages", async () => {
    mockBufferedPageRange = { start: 0, count: 3 };
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    for (const expected of ["1/3. oldal", "2/3. oldal", "3/3. oldal"]) {
      expect(mockDrawnTexts.filter((t) => t === expected)).toHaveLength(1);
    }
  });
});

// AC9/AC10: party cards — two side by side with a company, one alone
// without, both reserved via a measured advance (the old `billToY + 56` is
// gone).
describe("generateInvoicePdf — party cards (AC9/AC10)", () => {
  it("draws two equal-height cards at the same top y, 16pt apart, with a company", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({
      invoice,
      company: {
        name: "Demo Kft.",
        taxNumber: "12345678-2-41",
        address: "Fő utca 1.",
        city: "Budapest",
        zipCode: "1000",
        bankAccount: "12345678-12345678-12345678",
      },
    });

    // Two roundedRect fills sized for a card (i.e. not the chip/header
    // band/totals panel — those are recognisable by their own geometry),
    // found by looking for two roundedRect fills sharing the same y and
    // height, side by side.
    const cardCandidates = mockRectCalls.filter((c) => c.radius === 10);
    expect(cardCandidates.length).toBeGreaterThanOrEqual(2);

    const [first, second] = cardCandidates;
    expect(first!.y).toBe(second!.y);
    expect(first!.height).toBe(second!.height);
    // 16pt gutter between the two cards.
    expect(second!.x).toBeCloseTo(first!.x + first!.width + 16, 5);
  });

  it("draws exactly one card at ~half content width without a company", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({ invoice });

    const cardCandidates = mockRectCalls.filter((c) => c.radius === 10);
    // Only the Vevő card (plus possibly the note box, which shares the
    // same radius but is drawn much lower and full width) — filter to the
    // top-of-document band by y proximity isn't needed here since there is
    // no exemption reason on this fixture, so exactly one card fill.
    expect(cardCandidates).toHaveLength(1);
    expect(cardCandidates[0]!.width).toBeLessThan(300);
  });

  it("advances past the cards by a measured amount, never the literal billToY + 56", async () => {
    const invoice = makeInvoice();

    await generateInvoicePdf({
      invoice,
      company: {
        name: "Demo Kft.",
        address: "Egy nagyon hosszú cím, ami több sorba törik a kártyán belül, Budapest",
      },
    });

    const cardCandidates = mockRectCalls.filter((c) => c.radius === 10);
    const cardsBottom = Math.max(...cardCandidates.map((c) => c.y + c.height));

    // The next draw after the cards is the meta row (issueDate label).
    const labels = documentLabels();
    const metaDraw = mockTextCalls.find((c) => c.text.startsWith(`${labels.issueDate}:`));
    expect(metaDraw).toBeDefined();
    expect(metaDraw!.y).toBeGreaterThanOrEqual(cardsBottom + 12);
    expect(metaDraw!.y).toBeLessThanOrEqual(cardsBottom + 24);
  });

  it("never contains the literal expression billToY + 56 in the source", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const source = fs.readFileSync(
      path.join(__dirname, "generate-pdf.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/billToY\s*\+\s*56/);
  });
});

// AC11: the meta row prints issue date, due date, currency, and — only
// when set — payment method.
describe("generateInvoicePdf — meta row (AC11)", () => {
  it("prints the payment method with its localized label when set", async () => {
    const invoice = makeInvoice({ paymentMethod: "transfer" });
    const labels = documentLabels();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(
      mockDrawnTexts.some((t) => t === `${labels.paymentMethod}: ${labels.paymentMethods.transfer}`)
    ).toBe(true);
  });

  it("does not print a payment-method label when unset, and consumes no extra height", async () => {
    const withMethod = makeInvoice({ paymentMethod: "cash" });
    const withoutMethod = makeInvoice({ paymentMethod: undefined });
    const labels = documentLabels();

    await generateInvoicePdf({ invoice: withoutMethod, company: { name: "Demo Kft." } });
    expect(mockDrawnTexts.some((t) => t.startsWith(`${labels.paymentMethod}:`))).toBe(false);
    const tableHeaderWithout = mockTextCalls.find((c) => c.text === labels.description);

    mockDrawnTexts = [];
    mockTextCalls = [];
    await generateInvoicePdf({ invoice: withMethod, company: { name: "Demo Kft." } });
    expect(mockDrawnTexts.some((t) => t.startsWith(`${labels.paymentMethod}:`))).toBe(true);

    // The meta row wraps onto as many lines as its segments need (AC11's
    // width-budget fix) rather than always drawing on one fixed line, so
    // comparing a single segment's y between the two runs no longer says
    // anything — the payment-method segment can land on a different line
    // of a differently-wrapped row. What AC11 actually promises is that
    // omitting the optional segment never leaves unused space: with this
    // fixture, both rows still wrap to the same number of lines (the
    // payment-method segment fits on the row's existing wrapped line
    // alongside the currency segment), so the table header that follows
    // starts at the same y either way.
    const tableHeaderWith = mockTextCalls.find((c) => c.text === labels.description);
    expect(tableHeaderWith).toBeDefined();
    expect(tableHeaderWithout).toBeDefined();
    expect(tableHeaderWith!.y).toBe(tableHeaderWithout!.y);
  });
});

// AC6: the meta row prints "Teljesítés kelte: <date>" between issue date
// and due date, only when a fulfillmentDate is resolved.
describe("generateInvoicePdf — fulfillment date meta segment (AC6)", () => {
  it("draws the fulfillment date segment when set", async () => {
    const invoice = makeInvoice({ fulfillmentDate: "2026-06-03" });
    const labels = documentLabels();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(
      mockDrawnTexts.some((t) => t.startsWith(`${labels.fulfillmentDate}:`))
    ).toBe(true);
  });

  it("does not draw a fulfillment date segment when unset", async () => {
    const invoice = makeInvoice({ fulfillmentDate: undefined });
    const labels = documentLabels();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(
      mockDrawnTexts.some((t) => t.startsWith(`${labels.fulfillmentDate}:`))
    ).toBe(false);
  });

  it("never prints the issue date value under the fulfillment-date label", async () => {
    const invoice = makeInvoice({ fulfillmentDate: undefined, issueDate: "2026-06-01" });
    const labels = documentLabels();

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDrawnTexts.some((t) => t.startsWith(`${labels.fulfillmentDate}:`))).toBe(false);
    expect(mockDrawnTexts.some((t) => t.startsWith(`${labels.issueDate}:`))).toBe(true);
  });
});

// AC12: each line item row prints its own net amount.
describe("generateInvoicePdf — line item net column (AC12)", () => {
  it("prints lineItemNetTotal(item) formatted for the invoice currency", async () => {
    const invoice = makeInvoice({
      currency: "HUF",
      lineItems: [makeLineItem({ quantity: 3, unitPrice: 1000, vatRate: 27 })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    // net = 3 * 1000 = 3000
    expect(mockDrawnTexts).toContain(formatDocumentAmount(3000, "HUF"));
  });

  it("does not change the printed totals (still from calculateInvoiceTotals)", async () => {
    const invoice = makeInvoice({
      currency: "HUF",
      lineItems: [makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })],
    });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    // net 200, vat 54, gross 254 — unchanged arithmetic.
    expect(mockDrawnTexts).toContain(formatDocumentAmount(200, "HUF"));
    expect(mockDrawnTexts).toContain(formatDocumentAmount(54, "HUF"));
    expect(mockDrawnTexts).toContain(formatDocumentAmount(254, "HUF"));
  });
});

// AC13: totals panel + grand-total band colours.
describe("generateInvoicePdf — totals panel (AC13)", () => {
  it("fills the totals panel with tint(accent, 0.12) and the grand-total band with tint(accent, 0.24)", async () => {
    const invoice = makeInvoice({ currency: "HUF" });
    const accent = "#6495ed";

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." }, template: { accentColor: accent } });

    const panelTint = tint(accent, 0.12);
    const bandTint = tint(accent, 0.24);
    expect(mockRectCalls.some((c) => c.fill === panelTint)).toBe(true);
    expect(mockRectCalls.some((c) => c.fill === bandTint)).toBe(true);
  });
});

// AC15: status chip — pill when present, nothing when absent.
describe("generateInvoicePdf — status chip (AC15)", () => {
  it("draws a pill for a printed status (draft/paid/cancelled)", async () => {
    const invoice = makeInvoice({ status: "paid" });
    const accent = "#6495ed";

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." }, template: { accentColor: accent } });

    const chipFill = tint(accent, 0.24);
    const labels = documentLabels();
    expect(mockDrawnTexts).toContain(labels.status.paid);
    expect(mockRectCalls.some((c) => c.fill === chipFill && c.radius && c.radius > 0)).toBe(true);
  });

  it("draws nothing for a non-printed status (e.g. sent)", async () => {
    const invoice = makeInvoice({ status: "sent" });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    const labels = documentLabels();
    expect(Object.values(labels.status)).not.toContain(
      mockDrawnTexts.find((t) => Object.values(labels.status).includes(t))
    );
  });
});

// Plan: docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md §4.2
// (AC6) — the notes continuation heading is drawn from a `pageAdded`
// listener scoped to the duration of the notes doc.text() call. It must be
// detached (in a `finally`) before generateInvoicePdf() returns, for an
// invoice with notes and for one without, or it would keep drawing captions
// on unrelated future pages of a long-lived doc.
describe("generateInvoicePdf — notes continuation listener cleanup (AC6)", () => {
  it("leaves no pageAdded listener attached after generating a PDF with notes", async () => {
    const invoice = makeInvoice({ notes: "Some notes that may or may not paginate." });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDocs).toHaveLength(1);
    expect(mockDocs[0]!.listenerCount("pageAdded")).toBe(0);
  });

  it("leaves no pageAdded listener attached after generating a PDF without notes", async () => {
    const invoice = makeInvoice({ notes: "" });

    await generateInvoicePdf({ invoice, company: { name: "Demo Kft." } });

    expect(mockDocs).toHaveLength(1);
    expect(mockDocs[0]!.listenerCount("pageAdded")).toBe(0);
  });
});
