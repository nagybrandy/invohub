// lib/invoices/generate-pdf.integration.test.ts
// Real pdfkit + real fonts, no mocks — exercises the actual embedding path
// end to end (AC8) and, since the pdf-invohub-brand-mark slice, the brand
// mark's arc ("A") path commands (AC10, this file's original numbering).
// Deliberately the slowest tests in this area; keep the case count small.
/** @jest-environment node */
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";
import { documentInk } from "@/lib/invoices/document-ink";
import { documentLabels } from "@/lib/invoices/document-labels";
import {
  footerBandTop,
  PDF_PAGE_MARGINS,
  tableColumns,
} from "@/lib/invoices/pdf-layout";
import { DEFAULT_PDF_TEMPLATE, PDF_FONT_SCALES, pdfFontSizes } from "@/lib/invoices/pdf-template/defaults";
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

// AC8 fixture (i): 16 line items + a long notes value.
//
// 16 rows of this description length already trip the line-item table's own
// explicit continuation break (item 16 alone doesn't fit under the header +
// totals-reserve budget on page 1 — see the "continuation pages (AC11)"
// describe block below), which lands the "Megjegyzés:" label on that same
// continuation page with most of a fresh page still free under it. Measured
// against the current embedded fonts, a ~2000-char body (this fixture's
// original size, and the plan's own estimate) comfortably fits in that
// remaining room and never itself repaginates — so a genuinely reproducing
// fixture for the notes-continuation bug (plan
// docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md §0) needs a
// body long enough to overflow that remaining room, not just the original
// ~2000-char estimate. 6000 chars measures to comfortably more than the
// room left after the label on the line-item continuation page.
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
    notes: longText(6000),
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
  // pages *during* a single long doc.text() call (e.g. fixtureLongNotes()'s
  // notes block), so a call's start and end page can legitimately differ.
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
  // Position of this call in the shared call/fillColor timeline (see
  // `orderCounter` in withRecordedDoc) — lets a test correlate "the last
  // fillColor set before this text call was recorded" (AC7).
  order: number;
};

type RecordedFillColorCall = {
  color: string;
  order: number;
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
): Promise<{
  pdf: Buffer;
  calls: RecordedTextCall[];
  fillColorCalls: RecordedFillColorCall[];
  pageCount: number;
  // Page objects in creation order (a Set preserves insertion order) — lets
  // a test find "every page after the one a given call started on" without
  // hardcoding a page index.
  pages: unknown[];
}> {
  const calls: RecordedTextCall[] = [];
  const fillColorCalls: RecordedFillColorCall[] = [];
  const pageIds = new Set<unknown>();
  // Shared timeline across both recorded arrays (AC7) — a fillColor call
  // recorded with a lower `order` than a text call happened strictly before
  // it, regardless of which array it landed in.
  let orderCounter = 0;

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

    const originalFillColor = doc.fillColor.bind(doc);
    doc.fillColor = ((color?: unknown, ...rest: unknown[]) => {
      const result = originalFillColor(color as never, ...(rest as []));
      if (typeof color === "string") {
        fillColorCalls.push({ color, order: orderCounter++ });
      }
      return result;
    }) as typeof doc.fillColor;

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
        order: orderCounter++,
      });
      return result;
    }) as typeof doc.text;
    return doc;
  });

  try {
    const pdf = await withPdfKitFonts(() => generateInvoicePdf({ ...extra, invoice }));
    return { pdf, calls, fillColorCalls, pageCount: pageIds.size, pages: [...pageIds] };
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

// The amount-due band is pageWidth * 0.42 wide with 14pt inner padding
// each side, and its value is drawn at fonts.subtitle + 4 (generate-pdf.ts,
// "Summary area"). A realistic large total must fit that box on one line at
// every template font scale — a wrapped grand total is the worst possible
// place for a layout bug.
describe("generateInvoicePdf — the amount due fits its band on one line", () => {
  it.each(PDF_FONT_SCALES)("at fontScale=%s", async (fontScale) => {
    await withPdfKitFonts(async () => {
      const doc = createPdfDocument({ margins: PDF_PAGE_MARGINS, size: "A4" });
      registerDocumentFonts(doc);
      const { bold } = documentFontNames(doc);
      const fonts = pdfFontSizes(fontScale);
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bandInnerWidth = pageWidth * 0.42 - 14 * 2;

      doc.font(bold).fontSize(fonts.subtitle + 4);
      for (const amount of ["98 765 432 Ft", "1 234 567,89 €"]) {
        expect(doc.widthOfString(amount)).toBeLessThanOrEqual(bandInnerWidth);
      }
      doc.end();
    });
  });
});

describe("generateInvoicePdf — no content under the footer band (AC8/AC10)", () => {
  const fixtures: Array<[string, () => Invoice]> = [
    ["16 line items + long notes", fixtureLongNotes],
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
    // The column header draws its labels uppercase (2026-09-22 redesign).
    const headerLabelTexts = [
      labels.description,
      labels.quantity,
      labels.unitPrice,
      labels.net,
      labels.vat,
      labels.gross,
    ].map((label) => label.toUpperCase());
    // A table header is one row (same page, same y) that starts with the
    // description label; the VAT summary also prints NETTÓ/BRUTTÓ captions,
    // so count per header row, not per label text.
    const descriptionLabel = headerLabelTexts[0]!;
    // page -> y of each header row on that page (pages are objects, so key a Map by them).
    const headerRowYsByPage = new Map<unknown, number[]>();
    for (const call of calls) {
      if (call.text === descriptionLabel) {
        headerRowYsByPage.set(call.startPage, [...(headerRowYsByPage.get(call.startPage) ?? []), call.startY]);
      }
    }
    expect(headerRowYsByPage.size).toBeGreaterThanOrEqual(2);
    for (const [page, ys] of headerRowYsByPage) {
      // Exactly one header row per page that carries line items…
      expect(ys).toHaveLength(1);
      // …and that row carries all six column labels.
      const rowLabels = new Set(
        calls.filter((c) => c.startPage === page && c.startY === ys[0] && headerLabelTexts.includes(c.text)).map((c) => c.text)
      );
      expect(rowLabels.size).toBe(headerLabelTexts.length);
    }

    const captionText = `${invoice.invoiceNumber} · ${labels.continued}`;
    const captionDraws = calls.filter((c) => c.text === captionText);
    // Once per continuation page (never page 1): total pages minus 1.
    expect(captionDraws.length).toBe(pageCount - 1);
    const captionPages = new Set(captionDraws.map((c) => c.startPage));
    expect(captionPages.size).toBe(captionDraws.length);

    // Every page carrying line items after page 1 is a captioned
    // continuation page; the only header page without a caption is page 1.
    // (A continuation page may also carry only the summary block — it still
    // gets the caption, just no table header.)
    const headerPagesWithoutCaption = Array.from(headerRowYsByPage.keys()).filter(
      (page) => !captionPages.has(page)
    );
    expect(headerPagesWithoutCaption).toHaveLength(1);
  });
});

// Plan: docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md — a
// notes-only continuation page (opened by pdfkit's own auto-pagination
// inside the notes doc.text() call, not our explicit line-item page break)
// gets the same "<invoiceNumber> · folytatás" banner the line-item
// continuation pages already get, plus a repeated
// "<notesLabel> (folytatás):" section label.
describe("generateInvoicePdf — notes continuation pages", () => {
  it("opens a notes continuation page with the invoice banner and a repeated notes label (AC1/AC2/AC3/AC7)", async () => {
    const invoice = fixtureLongNotes();
    const { calls, fillColorCalls, pages } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    const labels = documentLabels();

    const notesCall = calls.find((c) => c.text === invoice.notes);
    expect(notesCall).toBeDefined();
    // Precondition (repro condition, plan §4.1): the notes body itself
    // paginates — its label page and its last page differ. Compared as a
    // boolean (not `.not.toBe(pageObject)`) so a failed assertion never
    // asks Jest's diff to pretty-print a live pdfkit PDFPage — those hold
    // circular refs back to the document and crash the worker's result
    // serialization instead of reporting a clean failure.
    expect(notesCall!.startPage === notesCall!.endPage).toBe(false);

    const startPageIndex = pages.indexOf(notesCall!.startPage);
    expect(startPageIndex).toBeGreaterThanOrEqual(0);
    // Every page after the label's page is, for this fixture, a notes
    // continuation page (notes is the last content block before the
    // footer — see fixtureLongNotes's own doc comment).
    const continuationPages = pages.slice(startPageIndex + 1);
    expect(continuationPages.length).toBeGreaterThanOrEqual(1);

    const continuationBanner = `${invoice.invoiceNumber || labels.draftNumber} · ${labels.continued}`;
    // fixtureLongNotes()'s own 16th line item already trips the line-item
    // table's pre-existing explicit page break (AC11, a different,
    // unrelated mechanism — see the "continuation pages (AC11)" describe
    // block above), which happens to land its own copy of this exact
    // banner text on the label's own page (notesCall.startPage). Only a
    // banner drawn on one of the *notes* continuation pages is this
    // slice's concern, so the AC11 one is excluded up front rather than
    // asserting on the combined, ambiguous count.
    const bannerDraws = calls.filter(
      (c) => c.text === continuationBanner && c.startPage !== notesCall!.startPage
    );

    // AC1: exactly one banner draw per continuation page, never on the
    // label's own page, at the page's top margin.
    expect(bannerDraws.length).toBe(continuationPages.length);
    for (const draw of bannerDraws) {
      // Boolean form — see the comment above on why page objects never go
      // straight into a matcher that might need to print them.
      expect(continuationPages.includes(draw.startPage)).toBe(true);
      expect(draw.startY).toBe(PDF_PAGE_MARGINS.top);
    }
    const bannerPages = new Set(bannerDraws.map((d) => d.startPage));
    expect(bannerPages.size).toBe(bannerDraws.length);

    // AC2: exactly one repeated notes label per continuation page, below
    // the banner.
    const repeatedLabelText = `${labels.sectionContinued.replace("{{section}}", DEFAULT_PDF_TEMPLATE.notesLabel)}:`;
    const labelDraws = calls.filter((c) => c.text === repeatedLabelText);
    expect(labelDraws.length).toBe(continuationPages.length);
    for (const page of continuationPages) {
      const banner = bannerDraws.find((d) => d.startPage === page);
      const label = labelDraws.find((d) => d.startPage === page);
      expect(banner).toBeDefined();
      expect(label).toBeDefined();
      // AC3: the repeated label starts strictly below the banner's bottom
      // (no overprint), and both stay comfortably inside the content area
      // (the existing footer-collision guard above covers the notes body
      // itself for every fixture, including this one).
      expect(label!.startY).toBeGreaterThan(banner!.endY);
      const bandTop = footerBandTop({ page } as never);
      expect(banner!.endY).toBeLessThan(bandTop);
      expect(label!.endY).toBeLessThan(bandTop);
    }

    // AC7: the last fillColor set before pdfkit resumes the wrapper (i.e.
    // the last one recorded before the outer notes text() call itself was
    // recorded) is documentInk.secondary — the same colour the notes body is
    // drawn in on page 1 — so the heading draw doesn't leak its own colour
    // into the continued body lines.
    const priorFillColors = fillColorCalls
      .filter((f) => f.order < notesCall!.order)
      .sort((a, b) => a.order - b.order);
    expect(priorFillColors.length).toBeGreaterThan(0);
    expect(priorFillColors[priorFillColors.length - 1]!.color).toBe(documentInk.secondary);
  });

  it("draws no continuation banner or repeated label when the notes fit on one page (AC4)", async () => {
    const invoice = buildSamplePreviewInvoice();
    const { calls, pageCount } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(pageCount).toBe(BASELINE_PAGE_COUNT);

    const labels = documentLabels();
    const continuationBanner = `${invoice.invoiceNumber || labels.draftNumber} · ${labels.continued}`;
    const repeatedLabelText = `${labels.sectionContinued.replace("{{section}}", DEFAULT_PDF_TEMPLATE.notesLabel)}:`;

    expect(calls.some((c) => c.text === continuationBanner)).toBe(false);
    expect(calls.some((c) => c.text === repeatedLabelText)).toBe(false);
  });

  it("leaves the 40-item line-item continuation behaviour unchanged for a notes-less invoice (AC5)", async () => {
    const invoice = fixtureManyLines();
    const { calls, pageCount } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(pageCount).toBeGreaterThanOrEqual(2);

    const labels = documentLabels();
    const captionText = `${invoice.invoiceNumber} · ${labels.continued}`;
    const captionDraws = calls.filter((c) => c.text === captionText);
    // Unchanged from the AC11 continuation-pages describe block above:
    // once per continuation page, never doubled by a notes listener that
    // was never attached (invoice.notes === "" for this fixture).
    expect(captionDraws.length).toBe(pageCount - 1);

    const repeatedLabelText = `${labels.sectionContinued.replace("{{section}}", DEFAULT_PDF_TEMPLATE.notesLabel)}:`;
    expect(calls.some((c) => c.text === repeatedLabelText)).toBe(false);
  });

  it("uses labels.draftNumber in the banner for an unfinalized invoice with paginating notes (AC8)", async () => {
    const invoice = { ...fixtureLongNotes(), invoiceNumber: "" };
    const { calls } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    const labels = documentLabels();
    const draftBanner = `${labels.draftNumber} · ${labels.continued}`;
    expect(calls.some((c) => c.text === draftBanner)).toBe(true);
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
  it("leaves no gap larger than 44pt along the content backbone, with a company", async () => {
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

    const measureDoc = createPdfDocument({ margins: PDF_PAGE_MARGINS, size: "A4" });
    registerDocumentFonts(measureDoc);
    const cols = tableColumns(measureDoc);
    const pageWidth = cols.right - cols.left;
    measureDoc.end();

    // Backbone anchors of the 2026-09-22 layout: the left content edge,
    // the payment-details box inset (12pt), and the totals column.
    const anchorXs = [cols.left, cols.left + 12, cols.right - pageWidth * 0.42];
    const isOnBackbone = (x: number) => anchorXs.some((anchor) => Math.abs(x - anchor) < 1);
    // Excludes the header logo badge's initials text — it happens to share
    // the body's left margin as its x (drawn at `left`), but is a narrow,
    // fixed-width (`size` = 52pt), centred draw belonging to the header
    // block, not the single-column body flow this guard follows. Every
    // real body draw on the backbone either passes no width (a plain
    // `doc.text(text, x, y)` call) or a width comparable to the content
    // area (well over 100pt).
    const isBodyWidth = (w: number | undefined) => w === undefined || w >= 50;

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
        // Section breaks (header -> meta strip -> parties -> table) are
        // deliberate ~22–26pt whitespace plus caption line-height in the
        // 2026-09-22 layout; anything well beyond that is still a hole.
        if (gap > 0) {
          expect(gap).toBeLessThanOrEqual(44);
        }
        blockEnd = Math.max(blockEnd, call.startY + call.height);
      }
    }
  });
});

// AC11 regression: the meta row must wrap instead of drawing past the right
// content margin when its segments (issue date, due date, fizetési mód,
// currency) don't fit on one line — see
// docs/plans/2026-09-16-pdf-layout-general-improvement.md's fix-round-2
// finding. Exercised at fontScale=large specifically, since that's where a
// set invoice.paymentMethod pushed the row furthest past budget.
describe("generateInvoicePdf — nothing is drawn past the right content margin", () => {
  it("keeps every text draw inside the content width at fontScale=large with a 5-cell meta strip (EUR + payment method)", async () => {
    const invoice = makeInvoice({
      paymentMethod: "transfer",
      currency: "EUR",
      exchangeRate: 395.12,
      invoiceNumber: "INV-2026-000147",
    });

    const { calls } = await withRecordedDoc(invoice, {
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41", bankAccount: "11773016-01234567-00000000" },
      template: { fontScale: "large" },
    });
    expect(calls.length).toBeGreaterThan(0);

    const right = 595.28 - PDF_PAGE_MARGINS.right;
    for (const call of calls) {
      // A draw with an explicit width box must fit its box inside the
      // margin; the box is where right-aligned text ends.
      if (call.optWidth !== undefined) {
        expect(call.startX + call.optWidth).toBeLessThanOrEqual(right + 0.5);
      } else {
        expect(call.startX).toBeLessThanOrEqual(right);
      }
    }
  });
});

