// lib/invoices/pdf-layout.test.ts
import {
  CONTENT_MARGIN_BOTTOM,
  companyInitials,
  contentBottom,
  drawTotalLine,
  ensureSpace,
  FOOTER_BAND_HEIGHT,
  footerBandTop,
  PAGE_MARGIN,
  tableColumns,
  totalsColumns,
} from "@/lib/invoices/pdf-layout";

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
