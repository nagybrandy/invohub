// lib/invoices/pdf-layout.test.ts
import {
  CONTENT_MARGIN_BOTTOM,
  companyInitials,
  contentBottom,
  drawNoteBox,
  drawPartyCard,
  drawTableHeader,
  drawTableRow,
  drawTotalLine,
  ensureSpace,
  FOOTER_BAND_HEIGHT,
  footerBandTop,
  PAGE_MARGIN,
  partyCardHeight,
  readableTextOn,
  tableColumns,
  tint,
  totalsColumns,
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

// AC5: totalsColumns aligns the value column flush with the table's Bruttó
// column and gives the label column enough width that Hungarian totals
// labels never wrap (see AC6 in the real-pdfkit integration test).
describe("totalsColumns (AC5)", () => {
  const stubDoc = () =>
    ({
      page: {
        width: 595.28,
        height: 841.89,
        margins: { left: 48, right: 48, top: 48, bottom: 48 },
      },
    }) as unknown as Parameters<typeof tableColumns>[0];

  it("aligns the value column flush with cols.right and reserves >= 120pt for labels", () => {
    const doc = stubDoc();
    const cols = tableColumns(doc);
    const totals = totalsColumns(doc, cols);

    expect(totals.valueX + totals.valueWidth).toBe(cols.right);
    expect(totals.labelX + totals.labelWidth + 8).toBe(totals.valueX);
    expect(totals.labelWidth).toBeGreaterThanOrEqual(120);
  });
});

// AC7: drawTotalLine returns a MEASURED advance (max of the label/value
// rendered heights + 6), not the old fixed fontSize + 6 — so a wrapped
// label no longer overlaps whatever is drawn next.
describe("drawTotalLine measured advance (AC7)", () => {
  it("advances by the max measured height of label/value, plus 6", () => {
    const calls: Array<{ text: string; width: number }> = [];
    const stub = {
      fontSize: () => stub,
      font: () => stub,
      fillColor: () => stub,
      text: (text: string, _x: number, _y: number, opts?: { width?: number }) => {
        calls.push({ text, width: opts?.width ?? 0 });
        return stub;
      },
      // A long label wraps to two lines (24pt); short values stay one line (12pt).
      heightOfString: (text: string) => (text.length > 20 ? 24 : 12),
    };
    const doc = stub as unknown as Parameters<typeof drawTotalLine>[0];

    const result = drawTotalLine(
      doc,
      "Fizetendő összesen, egy nagyon hosszú címke:",
      "100 Ft",
      0,
      0,
      100,
      50,
      50
    );

    expect(result).toBe(100 + 24 + 6);
  });

  it("advances by the value's measured height when the value is taller than the label", () => {
    const stub = {
      fontSize: () => stub,
      font: () => stub,
      fillColor: () => stub,
      text: () => stub,
      heightOfString: (text: string) => (text.length > 20 ? 24 : 12),
    };
    const doc = stub as unknown as Parameters<typeof drawTotalLine>[0];

    const result = drawTotalLine(
      doc,
      "short",
      "a suspiciously long formatted value string",
      0,
      0,
      100,
      50,
      50
    );

    expect(result).toBe(100 + 24 + 6);
  });
});

// AC1: tint(hex, ratio) mixes toward white, clamps ratio, falls back for
// malformed input.
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
describe("drawTableHeader (AC4)", () => {
  it("fills a band in accent and draws all 6 labels in readableTextOn(accent)", () => {
    const { doc, drawnTexts, fillColorCalls, rectCalls } = makeStubDoc();
    doc.y = 100;
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);
    const accent = "#6495ed";

    const labels = ["Megnevezés", "Mennyiség", "Egységár", "Nettó", "ÁFA", "Bruttó"];
    const result = drawTableHeader(doc as never, cols, labels, 9, accent);

    expect(rectCalls.some((c) => c.fill === accent)).toBe(true);
    for (const label of labels) {
      expect(drawnTexts.some((d) => d.text === label)).toBe(true);
    }
    expect(fillColorCalls).toContain(readableTextOn(accent));
    expect(result).toBeGreaterThan(100);
  });

  it("grows the band when a header label wraps to two lines", () => {
    const tall = makeStubDoc({
      heightOfString: (text) => (text === "Megnevezés" ? 30 : 12),
    });
    const short = makeStubDoc();
    tall.doc.y = 100;
    short.doc.y = 100;
    const cols = tableColumns(tall.doc as unknown as Parameters<typeof tableColumns>[0]);
    const labels = ["Megnevezés", "Mennyiség", "Egységár", "Nettó", "ÁFA", "Bruttó"];

    const tallResult = drawTableHeader(tall.doc as never, cols, labels, 9, "#6495ed");
    const shortResult = drawTableHeader(short.doc as never, cols, labels, 9, "#6495ed");

    expect(tallResult).toBeGreaterThan(shortResult);
  });
});

// AC5: drawTableRow draws the Nettó cell + a hairline separator, and keeps
// the same measured bottom-y rule.
describe("drawTableRow (AC5)", () => {
  it("draws the net cell and a #e5e9f5 hairline spanning cols.left..cols.right", () => {
    const { doc, drawnTexts, strokeCalls } = makeStubDoc();
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);

    const bottomY = drawTableRow(
      doc as never,
      cols,
      {
        description: "Tanácsadás",
        quantity: "2",
        unitPrice: "10 000 Ft",
        net: "20 000 Ft",
        vat: "27%",
        total: "25 400 Ft",
      },
      200,
      9
    );

    expect(drawnTexts.some((d) => d.text === "20 000 Ft" && d.x === cols.netX)).toBe(true);
    const hairline = strokeCalls.find((s) => s.color === "#e5e9f5");
    expect(hairline).toBeDefined();
    expect(hairline!.y1).toBe(bottomY);
    expect(hairline!.y2).toBe(bottomY);
    expect(hairline!.x1).toBe(cols.left);
    expect(hairline!.x2).toBe(cols.right);
  });

  it("returns the same measured bottom-y rule as before (max(descHeight, singleLine) + 6)", () => {
    const { doc } = makeStubDoc({
      heightOfString: (text) => (text === "A very long description that wraps" ? 30 : 12),
    });
    const cols = tableColumns(doc as unknown as Parameters<typeof tableColumns>[0]);

    const bottomY = drawTableRow(
      doc as never,
      cols,
      {
        description: "A very long description that wraps",
        quantity: "1",
        unitPrice: "1 Ft",
        net: "1 Ft",
        vat: "0%",
        total: "1 Ft",
      },
      100,
      9
    );

    expect(bottomY).toBe(100 + Math.max(30, 12) + 6);
  });
});

// AC6: drawPartyCard / partyCardHeight.
describe("drawPartyCard / partyCardHeight (AC6)", () => {
  const fontSizes = { title: 9, body: 9 };

  it("partyCardHeight equals the drawPartyCard return delta", () => {
    const { doc } = makeStubDoc();
    const opts = { width: 200, title: "Kibocsátó", lines: ["Demo Kft.", "Adószám: 123"], fontSizes };

    const measured = partyCardHeight(doc as never, opts);
    const bottom = drawPartyCard(doc as never, { ...opts, x: 48, y: 100, accent: "#6495ed" });

    expect(bottom - 100).toBe(measured);
  });

  it("draws a rounded, tint(accent, 0.12)-filled card with an uppercase title, and lines inside 10pt padding", () => {
    const { doc, drawnTexts, rectCalls } = makeStubDoc();
    const accent = "#6495ed";
    const opts = { width: 200, title: "Vevő", lines: ["Ügyfél Kft.", "Adószám: 999"], fontSizes };

    drawPartyCard(doc as never, { ...opts, x: 48, y: 100, accent });

    expect(rectCalls.some((c) => c.fill === tint(accent, 0.12) && c.radius === 10)).toBe(true);
    expect(drawnTexts.some((d) => d.text === "VEVŐ")).toBe(true);
    for (const line of opts.lines) {
      const draw = drawnTexts.find((d) => d.text === line);
      expect(draw).toBeDefined();
      expect(draw!.x).toBe(48 + 10);
    }
  });

  it("draws at a forced height when one is given, instead of its own measured height", () => {
    const { doc, rectCalls } = makeStubDoc();
    const opts = { width: 200, title: "Vevő", lines: ["Ügyfél Kft."], fontSizes };
    const naturalHeight = partyCardHeight(doc as never, opts);
    const forcedHeight = naturalHeight + 40;

    const bottom = drawPartyCard(doc as never, { ...opts, x: 48, y: 100, accent: "#6495ed", height: forcedHeight });

    expect(bottom).toBe(100 + forcedHeight);
    expect(rectCalls[0]!.height).toBe(forcedHeight);
  });
});

// AC7: drawNoteBox.
describe("drawNoteBox (AC7)", () => {
  it("draws a rounded, tinted, padded box around wrapped text and returns its measured bottom y", () => {
    const { doc, drawnTexts, rectCalls } = makeStubDoc();
    const fill = "#d9e7ff";

    const bottom = drawNoteBox(doc as never, {
      x: 48,
      y: 300,
      width: 400,
      lines: ["Alanyi adómentes", "Fordított adózás"],
      fill,
      fontSize: 9,
    });

    expect(rectCalls.some((c) => c.fill === fill && c.radius && c.radius > 0)).toBe(true);
    expect(drawnTexts.some((d) => d.text === "Alanyi adómentes")).toBe(true);
    expect(drawnTexts.some((d) => d.text === "Fordított adózás")).toBe(true);
    expect(bottom).toBeGreaterThan(300);
  });
});
