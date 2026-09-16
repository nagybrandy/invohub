// lib/invoices/generate-pdf.integration.test.ts
// Real pdfkit + real fonts, no mocks — exercises the actual embedding path
// end to end (AC8) and, since the pdf-invohub-brand-mark slice, the brand
// mark's arc ("A") path commands (AC10, this file's original numbering).
// Deliberately the slowest tests in this area; keep the case count small.
/** @jest-environment node */
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";
import { documentLabels } from "@/lib/invoices/document-labels";
import {
  footerBandTop,
  tableColumns,
  totalsColumns,
} from "@/lib/invoices/pdf-layout";
import { PDF_FONT_SCALES, pdfFontSizes } from "@/lib/invoices/pdf-template/defaults";
import { documentFontNames, registerDocumentFonts } from "@/lib/invoices/pdf-fonts";
import { createPdfDocument, withPdfKitFonts } from "@/lib/invoices/pdf-document";
import * as pdfDocumentModule from "@/lib/invoices/pdf-document";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Invoice } from "@/lib/invoices/types";

// AC9: buildSamplePreviewInvoice() — the default 1–2 item sample — must
// render on exactly 1 page (this slice's regression guard against the
// "blank page" family of pagination defects; see plan §1 note).
const BASELINE_PAGE_COUNT = 1;

function countPages(pdf: Buffer): number | null {
  const text = pdf.toString("latin1");
  const match = text.match(/\/Type\s*\/Pages[^]*?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

function longText(charCount: number): string {
  const base = "Ez egy hosszú, ismétlődő szöveg a PDF tördelés teszteléséhez. ";
  return base.repeat(Math.ceil(charCount / base.length)).slice(0, charCount);
}

// AC8 fixture (i): 16 line items + a ~2000-character notes value.
function fixtureLongNotes(): Invoice {
  return makeInvoice({
    invoiceNumber: "INV-2026-LONGNOTES",
    lineItems: Array.from({ length: 16 }, (_, i) =>
      makeLineItem({
        id: `l${i}`,
        description: `Tétel ${i + 1} — hosszabb leírással a sortördeléshez`,
        quantity: i + 1,
        unitPrice: 12500,
      })
    ),
    notes: longText(2000),
  });
}

// AC8 fixture (ii) / AC11: 40 line items — spans multiple pages.
function fixtureManyLines(): Invoice {
  return makeInvoice({
    invoiceNumber: "INV-2026-MANYLINES",
    lineItems: Array.from({ length: 40 }, (_, i) =>
      makeLineItem({ id: `l${i}`, description: `Tétel ${i + 1}`, quantity: 1, unitPrice: 5000 })
    ),
    notes: "",
  });
}

// AC8 fixture (iii): two ÁFA-exempt lines with a ~180-character exemption reason.
function fixtureExemptionReason(): Invoice {
  const reason = longText(180);
  return makeInvoice({
    invoiceNumber: "INV-2026-EXEMPT",
    lineItems: [
      makeLineItem({ id: "l1", vatCategory: "AAM", vatRate: 0, vatExemptionReason: reason }),
      makeLineItem({
        id: "l2",
        description: "Second exempt line",
        vatCategory: "AAM",
        vatRate: 0,
        vatExemptionReason: reason,
      }),
    ],
    notes: "",
  });
}

type RecordedTextCall = {
  // The page the call STARTED drawing on, and the page doc.y ended up on
  // once the call returned — pdfkit's own internal auto-pagination (AC1/
  // AC2: page.margins.bottom === CONTENT_MARGIN_BOTTOM) can add one or more
  // pages *during* a single long doc.text() call (e.g. the ~2000-char notes
  // block), so a call's start and end page can legitimately differ.
  startPage: unknown;
  endPage: unknown;
  text: string;
  startX: number;
  // The raw `options.width` passed to this .text() call, or undefined when
  // none was given — used by the AC18 density guard to tell a full-width
  // (or unset-width) body draw apart from a narrow fixed-width draw like
  // the header's logo-badge initials, which happens to share the body's
  // left margin as its x but is not part of the single-column content flow.
  optWidth?: number;
  startY: number;
  endY: number;
  height: number;
  marginBottom: number;
};

/**
 * Generates a PDF while recording every `doc.text()` call's start Y, ending
 * Y, measured (un-paginated) height, the page(s) it touched (by object
 * identity — pdfkit reuses one PDFPage instance per page, including across
 * switchToPage), and the live `page.margins.bottom` at call time (0 during
 * the footer pass, CONTENT_MARGIN_BOTTOM otherwise — see generate-pdf.ts's
 * zero-out around drawFooterOnCurrentPage). Every `.text()` call in this
 * codebase passes explicit `x, y[, options]` (verified by inspection of
 * pdf-layout.ts / generate-pdf.ts), so the wrapper only needs to support
 * that shape. Page count is tracked via pdfkit's own 'pageAdded' event
 * (fired for every addPage(), ours and pdfkit's own internal ones) so it
 * reflects every page, including one that ends up with no text draw on it.
 */
async function withRecordedDoc(
  invoice: Invoice,
  extra: Parameters<typeof generateInvoicePdf>[0] = { invoice }
): Promise<{ pdf: Buffer; calls: RecordedTextCall[]; pageCount: number }> {
  const calls: RecordedTextCall[] = [];
  const pageIds = new Set<unknown>();

  // Capture the real implementation before spying — with Babel's CJS
  // interop, the imported `createPdfDocument` binding resolves through
  // `pdfDocumentModule.createPdfDocument` at each call site, so calling it
  // from inside the mock (after jest.spyOn replaces that property) would
  // recurse into the mock itself.
  const originalCreatePdfDocument = pdfDocumentModule.createPdfDocument;
  const spy = jest.spyOn(pdfDocumentModule, "createPdfDocument").mockImplementation((options) => {
    const doc = originalCreatePdfDocument(options);
    pageIds.add(doc.page);
    doc.on("pageAdded", () => pageIds.add(doc.page));

    const originalText = doc.text.bind(doc);
    doc.text = ((value: string, ...rest: unknown[]) => {
      const x = typeof rest[0] === "number" ? (rest[0] as number) : undefined;
      const y = typeof rest[1] === "number" ? (rest[1] as number) : doc.y;
      const opts = (rest[2] ?? (typeof rest[0] === "object" ? rest[0] : undefined) ?? {}) as {
        width?: number;
      };
      const width =
        opts.width ??
        doc.page.width - doc.page.margins.right - (x ?? doc.page.margins.left);
      const startPage = doc.page;
      const height = doc.heightOfString(String(value), { width });
      const marginBottom = doc.page.margins.bottom;

      const result = originalText(value, ...(rest as Parameters<typeof originalText>));

      calls.push({
        startPage,
        endPage: doc.page,
        text: String(value),
        startX: x ?? doc.page.margins.left,
        optWidth: opts.width,
        startY: y,
        endY: doc.y,
        height,
        marginBottom,
      });
      return result;
    }) as typeof doc.text;
    return doc;
  });

  try {
    const pdf = await withPdfKitFonts(() => generateInvoicePdf({ ...extra, invoice }));
    return { pdf, calls, pageCount: pageIds.size };
  } finally {
    spy.mockRestore();
  }
}

describe("generateInvoicePdf (real pdfkit integration)", () => {
  it("generates a %PDF buffer with an embedded FontFile2 for the sample invoice", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    // FontFile2 is the PDF stream keyword for an embedded TrueType font
    // program — its presence means a real font is embedded, not merely
    // referenced by name.
    expect(pdf.includes("FontFile2")).toBe(true);
  });

  it("renders the brand mark's arc path commands without throwing, on exactly 1 page, with a company (AC9)", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.includes("FontFile2")).toBe(true);

    const pageCount = countPages(pdf);
    expect(pageCount).toBe(BASELINE_PAGE_COUNT);
  });

  it("renders the same, without a company, on exactly 1 page (AC9)", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({ invoice });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.includes("FontFile2")).toBe(true);

    const pageCount = countPages(pdf);
    expect(pageCount).toBe(BASELINE_PAGE_COUNT);
  });
});

describe("generateInvoicePdf — totals label width never wraps (AC6)", () => {
  it.each(PDF_FONT_SCALES)(
    "'Fizetendő összesen:' fits totalsColumns(...).labelWidth at fontScale=%s",
    async (fontScale) => {
      await withPdfKitFonts(async () => {
        const doc = createPdfDocument({
          margin: 48,
          size: "A4",
        });
        registerDocumentFonts(doc);
        const { bold } = documentFontNames(doc);
        const fonts = pdfFontSizes(fontScale);
        const cols = tableColumns(doc);
        const totals = totalsColumns(doc, cols);
        const labels = documentLabels();

        doc.font(bold).fontSize(fonts.subtitle);
        const width = doc.widthOfString(`${labels.grossTotal}:`);

        expect(width).toBeLessThanOrEqual(totals.labelWidth);
        doc.end();
      });
    }
  );
});

describe("generateInvoicePdf — no content under the footer band (AC8/AC10)", () => {
  const fixtures: Array<[string, () => Invoice]> = [
    ["16 line items + ~2000-char notes", fixtureLongNotes],
    ["40 line items", fixtureManyLines],
    ["two ÁFA-exempt lines + ~180-char exemption reason", fixtureExemptionReason],
  ];

  it.each(fixtures)("%s — no content draw enters the footer band", async (_label, build) => {
    const invoice = build();
    const { calls } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    const contentCalls = calls.filter((c) => c.marginBottom !== 0);
    expect(contentCalls.length).toBeGreaterThan(0);

    for (const call of contentCalls) {
      const bandTop = footerBandTop({ page: call.startPage } as never);
      const roomOnStartPage = bandTop - call.startY;

      if (call.height <= roomOnStartPage + 0.5) {
        // The whole block fits on the page it started on — it must not
        // start below, or extend past, the footer band on that page.
        expect(call.startY).toBeLessThan(bandTop);
        expect(call.startY + call.height).toBeLessThanOrEqual(bandTop + 0.5);
      } else {
        // The block (e.g. a long notes value) is taller than the room left
        // on its starting page — pdfkit's own auto-pagination (AC1/AC2:
        // page.margins.bottom === CONTENT_MARGIN_BOTTOM) breaks it across
        // pages instead of overprinting the footer. Verify the cursor
        // landed back inside a valid content area on whichever page it
        // ended, not past that page's own footer band.
        const endBandTop = footerBandTop({ page: call.endPage } as never);
        expect(call.endY).toBeLessThanOrEqual(endBandTop + 0.5);
      }
    }
  });

  it.each(fixtures)("%s — no page exists solely to carry the footer strip (AC10)", async (_label, build) => {
    const invoice = build();
    const { calls, pageCount } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    const contentPages = new Set<unknown>();
    for (const call of calls) {
      if (call.marginBottom === 0) continue;
      contentPages.add(call.startPage);
      contentPages.add(call.endPage);
    }
    expect(contentPages.size).toBe(pageCount);
  });
});

describe("generateInvoicePdf — continuation pages (AC11)", () => {
  it("repeats the table header once per page carrying line items, and draws the folytatás caption once per continuation page", async () => {
    const invoice = fixtureManyLines();
    const { calls, pageCount } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(pageCount).toBeGreaterThanOrEqual(2);

    const labels = documentLabels();
    const headerLabelTexts = [
      labels.description,
      labels.quantity,
      labels.unitPrice,
      labels.net,
      labels.vat,
      labels.gross,
    ];
    const headerDrawsPerPage = new Map<unknown, number>();
    for (const call of calls) {
      if (headerLabelTexts.includes(call.text)) {
        headerDrawsPerPage.set(call.startPage, (headerDrawsPerPage.get(call.startPage) ?? 0) + 1);
      }
    }
    // Every page that got a header draw got the full 5-label set exactly once.
    for (const count of headerDrawsPerPage.values()) {
      expect(count).toBe(headerLabelTexts.length);
    }

    const captionText = `${invoice.invoiceNumber} · ${labels.continued}`;
    const captionDraws = calls.filter((c) => c.text === captionText);
    // Once per continuation page (never page 1): total pages minus 1.
    expect(captionDraws.length).toBe(pageCount - 1);
    const captionPages = new Set(captionDraws.map((c) => c.startPage));
    expect(captionPages.size).toBe(captionDraws.length);

    // Every page that carries a caption also got a repeated header.
    for (const page of captionPages) {
      expect(headerDrawsPerPage.get(page)).toBe(headerLabelTexts.length);
    }
    // The number of header draws equals the number of pages with line items
    // (page 1's initial header + one per continuation page).
    expect(headerDrawsPerPage.size).toBe(pageCount);
  });
});

// AC18: no fixed-gap "holes" left in the body — no vertical gap larger than
// 28pt between the end of one drawn content block and the start of the
// next (the footer band is excluded, since it is deliberately reserved
// whitespace, not a layout defect).
//
// The document has two side-by-side columns in the party-card region
// (Kibocsátó/Vevő), which a naive global Y-sort across ALL text would
// misread as gaps whenever one card has fewer lines than the other (its
// own AC10 range of 12–24pt above cardsBottom already covers that
// transition specifically, in generate-pdf.test.ts). This guard instead
// follows the single-column backbone that every section shares an anchor
// on — the description column (table header/rows, note box, notes) and the
// totals label column — which is where a fixed, content-independent gap
// would actually show up as unused whitespace.
describe("generateInvoicePdf — density guard (AC18)", () => {
  it("leaves no gap larger than 28pt along the single-column backbone, with a company", async () => {
    const invoice = buildSamplePreviewInvoice();
    const { calls } = await withRecordedDoc(invoice, {
      invoice,
      company: {
        name: "InvoHub Demo Kft.",
        taxNumber: "12345678-2-41",
        address: "Fő utca 1.",
        city: "Budapest",
        zipCode: "1000",
        bankAccount: "12345678-12345678-12345678",
      },
    });

    const measureDoc = createPdfDocument({ margin: 48, size: "A4" });
    registerDocumentFonts(measureDoc);
    const cols = tableColumns(measureDoc);
    const totalsCols = totalsColumns(measureDoc, cols);
    measureDoc.end();

    const anchorXs = [cols.left, totalsCols.labelX];
    const isOnBackbone = (x: number) => anchorXs.some((anchor) => Math.abs(x - anchor) < 1);
    // Excludes the header logo badge's initials text — it happens to share
    // the body's left margin as its x (drawn at `left`), but is a narrow,
    // fixed-width (`size` = 52pt), centred draw belonging to the header
    // block, not the single-column body flow this guard follows. Every
    // real body draw on the backbone either passes no width (a plain
    // `doc.text(text, x, y)` call) or a width comparable to the content
    // area (well over 100pt).
    const isBodyWidth = (w: number | undefined) => w === undefined || w >= 100;

    const backboneCalls = calls.filter(
      (c) => c.marginBottom !== 0 && c.text.trim().length > 0 && isOnBackbone(c.startX) && isBodyWidth(c.optWidth)
    );
    expect(backboneCalls.length).toBeGreaterThan(0);

    const byPage = new Map<unknown, RecordedTextCall[]>();
    for (const call of backboneCalls) {
      const list = byPage.get(call.startPage) ?? [];
      list.push(call);
      byPage.set(call.startPage, list);
    }

    for (const pageCalls of byPage.values()) {
      const sorted = [...pageCalls].sort((a, b) => a.startY - b.startY);
      let blockEnd = sorted[0]!.startY;
      for (const call of sorted) {
        const gap = call.startY - blockEnd;
        if (gap > 0) {
          expect(gap).toBeLessThanOrEqual(28);
        }
        blockEnd = Math.max(blockEnd, call.startY + call.height);
      }
    }
  });
});
