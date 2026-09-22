// lib/invoices/pdf-layout.test.ts
import {
  CONTENT_MARGIN_BOTTOM,
  companyInitials,
  contentBottom,
  DOCUMENT_HAIRLINE,
  DOCUMENT_RULE,
  drawPartyBlock,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  FOOTER_BAND_HEIGHT,
  footerBandTop,
  PAGE_MARGIN,
  partyBlockHeight,
  readableTextOn,
  tableColumns,
  tint,
} from "@/lib/invoices/pdf-layout";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";

// A permissive stub doc supporting every pdfkit call the new pdf-layout.ts
// helpers issue, with recording arrays so tests can assert on what was
// drawn without a real pdfkit instance.
function makeStubDoc(overrides?: { heightOfString?: (text: string, opts?: { width?: number }) => number }) {
  const drawnTexts: Array<{ text: string; x: number; y: number; width?: number; align?: string }> = [];
  const fillColorCalls: string[] = [];
  const rectCalls: Array<{ x: number; y: number; width: number; height: number; radius?: number; fill?: string }> = [];
  let lastShape: { x: number; y: number; width: number; height: number; radius?: number } | null = null;
  const strokeCalls: Array<{ x1: number; y1: number; x2: number; y2: number; color?: string }> = [];
  let lastMove: { x: number; y: number } | null = null;
  let lastLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let strokeColorValue = "#000000";

  const doc = {
    page: {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    },
    y: 100,
    _registeredFonts: {},
    fontSize() {
      return doc;
    },
    font() {
      return doc;
    },
    fillColor(color?: string) {
      if (color) fillColorCalls.push(color);
      return doc;
    },
    fill(color?: string) {
      if (lastShape) rectCalls.push({ ...lastShape, fill: color });
      return doc;
    },
    text(text: string, x: number, y: number, opts?: { width?: number; align?: string }) {
      drawnTexts.push({ text, x, y, width: opts?.width, align: opts?.align });
      return doc;
    },
    heightOfString(text: string, opts?: { width?: number }) {
      if (overrides?.heightOfString) return overrides.heightOfString(text, opts);
      return 12;
    },
    widthOfString(text: string) {
      return String(text).length * 6;
    },
    currentLineHeight() {
      return 12;
    },
    roundedRect(x: number, y: number, width: number, height: number, radius?: number) {
      lastShape = { x, y, width, height, radius };
      return doc;
    },
    rect(x: number, y: number, width: number, height: number) {
      lastShape = { x, y, width, height };
      return doc;
    },
    moveTo(x: number, y: number) {
      lastMove = { x, y };
      return doc;
    },
    lineTo(x: number, y: number) {
      if (lastMove) lastLine = { x1: lastMove.x, y1: lastMove.y, x2: x, y2: y };
      return doc;
    },
    strokeColor(color?: string) {
      if (color) strokeColorValue = color;
      return doc;
    },
    lineWidth() {
      return doc;
    },
    // Real pdfkit paints on `.stroke()`, using whatever colour was set on
    // the chain up to that point — `strokeColor(...)` is typically called
    // AFTER `.moveTo().lineTo()` in this codebase, so recording at
    // `.lineTo()` time (before the colour is set) would miss it.
    stroke() {
      if (lastLine) strokeCalls.push({ ...lastLine, color: strokeColorValue });
      return doc;
    },
  };

  return { doc, drawnTexts, fillColorCalls, rectCalls, strokeCalls };
}

describe("companyInitials", () => {
  it("uses first letters of first two words", () => {
    expect(companyInitials("InvoHub Demo Kft.")).toBe("ID");
  });

  it("uses first two letters for single word", () => {
    expect(companyInitials("Acme")).toBe("AC");
  });

  it("returns fallback for empty name", () => {
    expect(companyInitials("   ")).toBe("?");
  });
});

describe("footerBandTop (AC9)", () => {
  const stubPage = () => ({
    page: {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    },
  });

  it("equals contentBottom(doc) with the default reserve", () => {
    const doc = stubPage() as unknown as Parameters<typeof footerBandTop>[0];
    expect(footerBandTop(doc)).toBe(contentBottom(doc));
  });

  it("reserves exactly FOOTER_BAND_HEIGHT above the bottom margin", () => {
    const doc = stubPage() as unknown as Parameters<typeof footerBandTop>[0];
    expect(FOOTER_BAND_HEIGHT).toBe(36);
    expect(doc.page.height - doc.page.margins.bottom - footerBandTop(doc)).toBe(
      FOOTER_BAND_HEIGHT
    );
  });
});

// AC1: contentBottom/footerBandTop are computed from the fixed geometry
// constants (PAGE_MARGIN + FOOTER_BAND_HEIGHT), never from the live
// page.margins.bottom — which the footer draw pass temporarily zeroes.
describe("contentBottom / footerBandTop geometry (AC1)", () => {
  const a4Page = (marginsBottom: number) => ({
    page: {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: marginsBottom },
    },
  });

  it("PAGE_MARGIN + FOOTER_BAND_HEIGHT equals CONTENT_MARGIN_BOTTOM (84)", () => {
    expect(PAGE_MARGIN).toBe(48);
    expect(FOOTER_BAND_HEIGHT).toBe(36);
    expect(CONTENT_MARGIN_BOTTOM).toBe(84);
  });

  it("returns doc.page.height - (PAGE_MARGIN + FOOTER_BAND_HEIGHT) — 757.89 on A4", () => {
    const doc = a4Page(48) as unknown as Parameters<typeof contentBottom>[0];
    expect(contentBottom(doc)).toBeCloseTo(757.89, 5);
    expect(footerBandTop(doc)).toBeCloseTo(757.89, 5);
    expect(contentBottom(doc)).toBe(footerBandTop(doc));
  });

  it("is unaffected when page.margins.bottom has been temporarily zeroed for the footer draw", () => {
    const zeroed = a4Page(0) as unknown as Parameters<typeof contentBottom>[0];
    const normal = a4Page(48) as unknown as Parameters<typeof contentBottom>[0];
    expect(contentBottom(zeroed)).toBe(contentBottom(normal));
    expect(footerBandTop(zeroed)).toBe(footerBandTop(normal));
  });
});

// AC3/AC4: ensureSpace never opens a page it is already standing at the top
// of (the "blank page" failure mode), and otherwise breaks exactly at the
// measured content boundary.
describe("ensureSpace (AC3/AC4)", () => {
  const makeDoc = (y: number, marginsTop = 48) => {
    const addPage = jest.fn();
    const doc = {
      y,
      page: {
        width: 595.28,
        height: 841.89,
        margins: { left: 48, right: 48, top: marginsTop, bottom: 48 },
      },
      addPage,
    };
    return doc as unknown as Parameters<typeof ensureSpace>[0] & { addPage: jest.Mock };
  };

  it("does not add a page when doc.y is at the top margin, for any n (AC3)", () => {
    const doc = makeDoc(48);
    ensureSpace(doc, 10_000);
    expect((doc as unknown as { addPage: jest.Mock }).addPage).not.toHaveBeenCalled();
  });

  it("does not add a page when doc.y is within 0.5pt of the top margin (AC3)", () => {
    const doc = makeDoc(48.5);
    ensureSpace(doc, 10_000);
    expect((doc as unknown as { addPage: jest.Mock }).addPage).not.toHaveBeenCalled();
  });

  it("adds a page when doc.y is past the top margin and the block would cross contentBottom (AC4)", () => {
    const doc = makeDoc(700);
    ensureSpace(doc, 100);
    expect((doc as unknown as { addPage: jest.Mock }).addPage).toHaveBeenCalledTimes(1);
  });

  it("does not add a page when doc.y is past the top margin but the block still fits (AC4)", () => {
    const doc = makeDoc(700);
    ensureSpace(doc, 40);
    expect((doc as unknown as { addPage: jest.Mock }).addPage).not.toHaveBeenCalled();
  });
});

describe("tint (AC1)", () => {
  it("returns the normalised color unchanged at ratio 0", () => {
    expect(tint("#6495ed", 0)).toBe("#6495ed");
    expect(tint("#ABCDEF", 0)).toBe("#abcdef");
  });

  it("returns pure white at ratio 1", () => {
    expect(tint("#111f4a", 1)).toBe("#ffffff");
    expect(tint("#6495ed", 1)).toBe("#ffffff");
  });

  it("clamps ratio below 0 and above 1", () => {
    expect(tint("#6495ed", -5)).toBe(tint("#6495ed", 0));
    expect(tint("#6495ed", 5)).toBe(tint("#6495ed", 1));
  });

  it("mixes toward white in between (monotonic per channel)", () => {
    const quarter = tint("#000000", 0.5);
    expect(quarter).toBe("#808080");
  });

  it("falls back to the default accent for malformed input", () => {
    expect(tint("not-a-color", 0.5)).toBe(tint(DEFAULT_PDF_TEMPLATE.accentColor, 0.5));
  });
});

// AC2: readableTextOn picks white or navy text for contrast.
describe("readableTextOn (AC2)", () => {
  it("returns white on dark fills", () => {
    expect(readableTextOn("#111f4a")).toBe("#ffffff");
    expect(readableTextOn("#6495ed")).toBe("#ffffff");
  });

  it("returns navy (#111f4a) on light fills", () => {
    expect(readableTextOn("#ffffff")).toBe("#111f4a");
    expect(readableTextOn("#ffe680")).toBe("#111f4a");
    expect(readableTextOn(tint("#6495ed", 0.24))).toBe("#111f4a");
  });
});

// AC3: tableColumns gains a Nettó column, still right-to-left, never
// overlapping, with a floor on descWidth.
describe("tableColumns — Nettó column (AC3)", () => {
  const a4Doc = () =>
    ({
      page: {
        width: 595.28,
        height: 841.89,
        margins: { left: 48, right: 48, top: 48, bottom: 84 },
      },
    }) as unknown as Parameters<typeof tableColumns>[0];

  it("adds netX/netWidth between unit and vat", () => {
    const cols = tableColumns(a4Doc());
    expect(cols.netX).toBeLessThan(cols.vatX);
    expect(cols.netX).toBeGreaterThan(cols.unitX);
    expect(cols.netWidth).toBeGreaterThan(0);
  });

  it("never overlaps at A4 with PDF_PAGE_MARGINS", () => {
    const cols = tableColumns(a4Doc());
    const gap = 8;
    expect(cols.left + cols.descWidth + gap).toBeLessThanOrEqual(cols.qtyX);
    expect(cols.qtyX + cols.qtyWidth + gap).toBeLessThanOrEqual(cols.unitX);
    expect(cols.unitX + cols.unitWidth + gap).toBeLessThanOrEqual(cols.netX);
    expect(cols.netX + cols.netWidth + gap).toBeLessThanOrEqual(cols.vatX);
    expect(cols.vatX + cols.vatWidth + gap).toBeLessThanOrEqual(cols.totalX);
    expect(cols.totalX + cols.totalWidth).toBeLessThanOrEqual(cols.right);
  });

  it("keeps descWidth >= 150", () => {
    const cols = tableColumns(a4Doc());
    expect(cols.descWidth).toBeGreaterThanOrEqual(150);
  });
});

// AC4: drawTableHeader fills a band in accent and draws 6 readable labels.
describe("drawTableHeader", () => {
  const labels = ["Megnevezés", "Mennyiség", "Egységár", "Nettó", "ÁFA", "Bruttó"];

  it("draws no filled band — uppercase labels over a single heading-ink rule", () => {
    const { doc, drawnTexts, rectCalls, strokeCalls } = makeStubDoc();
    doc.y = 100;
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);

    const result = drawTableHeader(doc as never, cols, labels, 9);

    expect(rectCalls).toHaveLength(0);
    for (const label of labels) {
      expect(drawnTexts.some((d) => d.text === label.toUpperCase())).toBe(true);
    }
    const rule = strokeCalls.find((c) => c.color === DOCUMENT_RULE);
    expect(rule).toBeDefined();
    expect(rule!.x1).toBe(cols.left);
    expect(rule!.x2).toBe(cols.right);
    expect(result).toBeGreaterThan(rule!.y1);
  });

  it("right-aligns every numeric column inside its own box, ending at the right margin", () => {
    const { doc, drawnTexts } = makeStubDoc();
    doc.y = 100;
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);
    drawTableHeader(doc as never, cols, labels, 9);
    const gross = drawnTexts.find((d) => d.text === "BRUTTÓ")!;
    expect(gross.align).toBe("right");
    expect(gross.x + (gross.width ?? 0)).toBe(cols.right);
  });

  it("grows when a header label wraps to two lines", () => {
    const tall = makeStubDoc({ heightOfString: (text) => (text === "MEGNEVEZÉS" ? 30 : 12) });
    const short = makeStubDoc();
    tall.doc.y = 100;
    short.doc.y = 100;
    const cols = tableColumns(tall.doc as unknown as Parameters<typeof tableColumns>[0]);
    expect(drawTableHeader(tall.doc as never, cols, labels, 9)).toBeGreaterThan(
      drawTableHeader(short.doc as never, cols, labels, 9)
    );
  });
});

describe("drawTableRow", () => {
  const row = {
    description: "Tanácsadás",
    quantity: "2 óra",
    unitPrice: "10 000 Ft",
    net: "20 000 Ft",
    vat: "27%",
    total: "25 400 Ft",
  };

  it("draws every cell in its column and a quiet hairline across the table", () => {
    const { doc, drawnTexts, strokeCalls } = makeStubDoc();
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);
    const bottomY = drawTableRow(doc as never, cols, row, 200, 9);

    expect(drawnTexts.some((d) => d.text === "20 000 Ft" && d.x === cols.netX)).toBe(true);
    expect(drawnTexts.some((d) => d.text === "2 óra" && d.x === cols.qtyX)).toBe(true);
    const hairline = strokeCalls.find((s) => s.color === DOCUMENT_HAIRLINE);
    expect(hairline).toBeDefined();
    expect(hairline!.x1).toBe(cols.left);
    expect(hairline!.x2).toBe(cols.right);
    expect(hairline!.y1).toBeLessThan(bottomY);
    expect(hairline!.y1).toBeGreaterThan(200);
  });

  it("grows with a wrapped description (measured, never a fixed row height)", () => {
    const wrapped = makeStubDoc({ heightOfString: (text) => (text === "long" ? 36 : 12) });
    const single = makeStubDoc();
    const cols = tableColumns(single.doc as unknown as Parameters<typeof tableColumns>[0]);
    const tallBottom = drawTableRow(wrapped.doc as never, cols, { ...row, description: "long" }, 100, 9);
    const shortBottom = drawTableRow(single.doc as never, cols, row, 100, 9);
    expect(tallBottom - shortBottom).toBe(36 - 12);
  });
});

describe("drawPartyBlock / partyBlockHeight", () => {
  const opts = {
    width: 230,
    title: "Vevő",
    name: "Duna Kft.",
    lines: ["1051 Budapest, Október 6. utca 12.", "Adószám: 12345678-2-13"],
    fontSizes: { label: 7.5, name: 10.5, body: 9 },
  };

  it("partyBlockHeight equals the drawPartyBlock return delta", () => {
    const { doc } = makeStubDoc();
    const measured = partyBlockHeight(doc as never, opts);
    const bottom = drawPartyBlock(doc as never, { ...opts, x: 48, y: 100, accent: "#6495ed" });
    expect(bottom - 100).toBe(measured);
  });

  it("draws an uppercase caption, the name and every detail line, with only the accent tick filled", () => {
    const { doc, drawnTexts, rectCalls } = makeStubDoc();
    drawPartyBlock(doc as never, { ...opts, x: 48, y: 100, accent: "#6495ed" });
    expect(drawnTexts.map((d) => d.text)).toEqual(["VEVŐ", "Duna Kft.", ...opts.lines]);
    expect(rectCalls).toHaveLength(1);
    expect(rectCalls[0]!.fill).toBe("#6495ed");
    expect(rectCalls[0]!.width).toBeLessThan(40);
  });

  it("skips empty detail lines", () => {
    const { doc, drawnTexts } = makeStubDoc();
    drawPartyBlock(doc as never, { ...opts, lines: ["", "Adószám: 1"], x: 48, y: 100, accent: "#6495ed" });
    expect(drawnTexts.map((d) => d.text)).toEqual(["VEVŐ", "Duna Kft.", "Adószám: 1"]);
  });
});
