// lib/invoices/paper/render-paper.test.ts
// Block-level behaviour of the paper renderer (real pdfkit, drawing calls
// recorded): layout tokens, logo modes/sizes/positions, brand colours,
// watermark, status tag, footer, pagination.
/** @jest-environment node */
import { renderRecorded, type PdfRecording, type RecordedShape } from "@/__tests__/helpers/pdf-recorder";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";
import type { InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { documentLabels } from "@/lib/invoices/document-labels";
import { paperPalette } from "@/lib/invoices/paper/brand-color";
import { LOGO_SIZE_PX, PX, px } from "@/lib/invoices/paper/tokens";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate, PdfLayout } from "@/lib/invoices/pdf-template/types";
import type { Invoice } from "@/lib/invoices/types";

const PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG_DATA_URI = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64")}`;

const COMPANY = {
  name: "Kovács Anna e.v.",
  taxNumber: "66123456-1-33",
  address: "Bartók Béla út 21. 2/4.",
  city: "Budapest",
  zipCode: "1114",
  bankAccount: "10700024-12345678-51100005",
};
const BUYER = { address: "Minta utca 12.", city: "Budapest", zipCode: "1117" };
const ACCENT = "#E8590C";
const PALETTE = paperPalette(ACCENT);

const tpl = (over: Partial<InvoicePdfTemplate> = {}): InvoicePdfTemplate => ({
  ...DEFAULT_PDF_TEMPLATE,
  accentColor: ACCENT,
  ...over,
});

async function render(
  over: Partial<InvoicePdfTemplate> = {},
  invoice: Invoice = buildSamplePreviewInvoice(),
  extra: Partial<InvoicePdfContext> = {}
): Promise<PdfRecording> {
  return renderRecorded({ invoice, company: COMPANY, buyer: BUYER, template: tpl(over), ...extra });
}

const fills = (r: PdfRecording, color: string): RecordedShape[] =>
  r.shapes.filter((s) => s.paint === "fill" && s.color?.toLowerCase() === color.toLowerCase());
const strokes = (r: PdfRecording, color: string): RecordedShape[] =>
  r.shapes.filter((s) => s.paint === "stroke" && s.color?.toLowerCase() === color.toLowerCase());
const textOf = (r: PdfRecording, text: string) => r.texts.find((t) => t.text === text);

const many = (n: number): Invoice =>
  makeInvoice({
    invoiceNumber: "INV-2026-00099",
    notes: "",
    lineItems: Array.from({ length: n }, (_, i) =>
      makeLineItem({ id: `l${i}`, description: `Tétel ${i + 1}`, quantity: 1, unitPrice: 5000 })
    ),
  });

describe("renderPaperPdf: layout tokens are data, not copies", () => {
  it("Sávos: tint fill band for the meta strip and the payment strip, ink-filled table header", async () => {
    const r = await render({ layout: "band" });
    const wide = fills(r, PALETTE.tint).filter((s) => s.kind === "rect" && Math.abs(s.w - 523.08) < 1);
    expect(wide.length).toBeGreaterThanOrEqual(2); // meta + payment strip
    expect(fills(r, PALETTE.tint).every((s) => s.kind === "rect")).toBe(true); // radius 0
    const header = fills(r, PALETTE.ink).filter((s) => Math.abs(s.w - 523.08) < 1 && s.h > px(15));
    expect(header.length).toBeGreaterThanOrEqual(1);
  });

  it("Keretes: rounded tint meta strip with a framed border, boxed parties and strip, ink-filled header", async () => {
    const r = await render({ layout: "frame" });
    const meta = fills(r, PALETTE.tint).find((s) => s.kind === "roundedRect");
    expect(meta?.radius).toBeCloseTo(px(8), 3);
    expect(strokes(r, PALETTE.frameBorder).length).toBeGreaterThanOrEqual(1);
    // parties + payment strip boxes: 1 px #E6E8EC strokes with radius 8 px
    const boxes = strokes(r, "#E6E8EC").filter((s) => s.kind === "roundedRect");
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    expect(fills(r, PALETTE.ink).some((s) => s.kind === "rect" && s.h > px(15))).toBe(true);
  });

  it("Letisztult: no fills on meta/parties/strip, table header is ink text over a 2 px ink underline", async () => {
    const r = await render({ layout: "clean" });
    expect(fills(r, PALETTE.tint)).toHaveLength(0);
    expect(strokes(r, PALETTE.frameBorder)).toHaveLength(0);
    // the table header is NOT an ink-filled block (only the 2 px rule and the logo are ink fills)
    expect(fills(r, PALETTE.ink).filter((s) => s.kind === "rect" && s.h > px(10))).toHaveLength(0);
    const label = r.texts.find((t) => t.text === "MEGNEVEZÉS");
    expect(label?.color.toLowerCase()).toBe(PALETTE.ink);
  });

  it("the table header labels are white on the ink fill for Sávos and Keretes", async () => {
    for (const layout of ["band", "frame"] as PdfLayout[]) {
      const r = await render({ layout });
      expect(r.texts.find((t) => t.text === "MEGNEVEZÉS")?.color.toLowerCase()).toBe("#ffffff");
    }
  });

  it("every layout draws the 2 px brand rule under the header and the 2 px rule over the grand total", async () => {
    for (const layout of ["clean", "band", "frame"] as PdfLayout[]) {
      const r = await render({ layout });
      const rules = fills(r, PALETTE.ink).filter((s) => s.kind === "rect" && Math.abs(s.h - px(2)) < 0.01);
      expect(rules.length).toBeGreaterThanOrEqual(2);
      expect(rules.some((s) => Math.abs(s.w - 523.08) < 1)).toBe(true);
    }
  });
});

describe("renderPaperPdf: brand colours", () => {
  it("draws the title in the darkened ink, never the raw colour", async () => {
    const r = await render({ layout: "clean" });
    expect(PALETTE.ink).not.toBe(ACCENT.toLowerCase());
    expect(textOf(r, "SZÁMLA")?.color.toLowerCase()).toBe(PALETTE.ink);
  });

  it("uses Dóri's blue for a malformed stored colour instead of throwing", async () => {
    const r = await render({ accentColor: "garbage" });
    expect(textOf(r, "SZÁMLA")?.color.toLowerCase()).toBe("#3f6bc4");
  });
});

describe("renderPaperPdf: logo", () => {
  it.each(["S", "M", "L"] as const)("monogram size %s is a %s design-px rounded square in ink with white initials", async (size) => {
    const r = await render({ logoSize: size });
    const sz = px(LOGO_SIZE_PX[size]);
    const badge = fills(r, PALETTE.ink).find((s) => s.kind === "roundedRect" && Math.abs(s.w - sz) < 0.01);
    expect(badge).toBeDefined();
    expect(badge!.h).toBeCloseTo(sz, 3);
    expect(badge!.radius).toBeCloseTo(px(6), 3);
    const initials = textOf(r, "KA");
    expect(initials?.color.toLowerCase()).toBe("#ffffff");
    expect(initials?.fontSize).toBeCloseTo(px(Math.round(LOGO_SIZE_PX[size] * 0.42)), 3);
  });

  it("logo size S/M/L maps to 22 / 30 / 42 design px (x PX pt)", () => {
    expect(LOGO_SIZE_PX).toEqual({ S: 22, M: 30, L: 42 });
    expect(px(30)).toBeCloseTo(30 * PX, 6);
  });

  it("logo 'none' draws no badge and no image", async () => {
    const r = await render({ logoMode: "none" });
    expect(r.shapes.filter((s) => s.kind === "roundedRect" && Math.abs(s.w - px(30)) < 0.01 && s.color === PALETTE.ink)).toHaveLength(0);
    expect(r.images).toHaveLength(0);
    expect(textOf(r, "KA")).toBeUndefined();
    // the issuer identity text is still there (and starts at the left margin)
    expect(textOf(r, "Kovács Anna e.v.")?.x).toBeCloseTo(px(34), 1);
  });

  it("own logo draws the data: PNG / JPEG image, scaled into size x 120 px", async () => {
    for (const uri of [PNG_DATA_URI, JPEG_DATA_URI]) {
      const r = await render({ logoMode: "own", logoSize: "L" }, undefined, { company: { ...COMPANY, logoUrl: uri } });
      if (uri === PNG_DATA_URI) {
        expect(r.images).toHaveLength(1);
        const { width, height } = r.images[0]!.options as { width: number; height: number };
        expect(height).toBeLessThanOrEqual(px(42) + 0.01);
        expect(width).toBeLessThanOrEqual(px(120) + 0.01);
        expect(textOf(r, "KA")).toBeUndefined();
      }
    }
  });

  it.each([
    ["an http(s) URL (never fetched)", "https://example.com/logo.png"],
    ["an SVG data URI", "data:image/svg+xml;base64,PHN2Zy8+"],
    ["a PNG data URI with garbage bytes", "data:image/png;base64,AAAA"],
    ["a mislabelled JPEG", `data:image/jpeg;base64,${PNG_DATA_URI.split(",")[1]}`],
    ["an empty URL", ""],
  ])("own logo falls back to the monogram for %s", async (_label, logoUrl) => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    try {
      const r = await render({ logoMode: "own" }, undefined, { company: { ...COMPANY, logoUrl } });
      expect(r.images).toHaveLength(0);
      expect(textOf(r, "KA")).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("position right swaps the header columns: title column left, issuer group flush right", async () => {
    const left = await render({ logoPosition: "left" });
    const right = await render({ logoPosition: "right" });
    expect(textOf(left, "SZÁMLA")!.x).toBeGreaterThan(300);
    // the title column starts at the left margin with the "Kiállítva" tag, the title follows it
    expect(textOf(right, "KIÁLLÍTVA")!.x).toBeCloseTo(px(34), 0);
    expect(textOf(right, "SZÁMLA")!.x).toBeLessThan(textOf(left, "SZÁMLA")!.x);
    expect(textOf(left, "Kovács Anna e.v.")!.x).toBeLessThan(120);
    expect(textOf(right, "Kovács Anna e.v.")!.x).toBeGreaterThan(200);
    // the logo stays to the left of the issuer text
    const badge = right.shapes.find((s) => s.kind === "roundedRect" && Math.abs(s.w - px(30)) < 0.01 && s.color === PALETTE.ink)!;
    expect(badge.x).toBeLessThan(textOf(right, "Kovács Anna e.v.")!.x);
  });

  it("monogram initials ignore the company form (e.v. / Kft.)", async () => {
    const r = await render({}, undefined, { company: { ...COMPANY, name: "Minta Tamás Kft." } });
    expect(textOf(r, "MT")).toBeDefined();
  });
});

describe("renderPaperPdf: fonts", () => {
  it.each([
    ["invohub", "StackSansNotch-Bold", "StackSansText"],
    ["classic", "SourceSerif4-Bold", "SourceSans3"],
    ["round", "Nunito-Bold", "NunitoSans"],
  ] as const)("%s style draws the title in %s and body text in %s", async (fontStyle, heading, body) => {
    const r = await render({ fontStyle });
    expect(textOf(r, "SZÁMLA")?.font).toContain(heading);
    expect(textOf(r, "Tech Solutions Kft.")?.font).toContain(body);
    expect(r.pdf.toString("latin1")).toContain("FontFile2");
  });

  it("falls back to the Noto pair, not an exception, when a style's font files are missing", async () => {
    const fs = jest.requireActual<typeof import("node:fs")>("node:fs");
    const realExists = fs.existsSync;
    const existsSpy = jest.spyOn(fs, "existsSync").mockImplementation((p) => (String(p).includes("nunito") ? false : realExists(p)));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await render({ fontStyle: "round" });
      expect(r.pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(textOf(r, "SZÁMLA")?.font).toContain("NotoSans");
    } finally {
      existsSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("renderPaperPdf: status tag, draft watermark, footer", () => {
  it("prints a status tag: Piszkozat / Fizetve / Törölve, else Dóri's grey KIÁLLÍTVA on a numbered document", async () => {
    const labels = documentLabels("hu");
    const status = { draft: labels.status.draft, paid: labels.status.paid, cancelled: labels.status.cancelled };
    const tags = [...Object.values(status), labels.issued].map((t) => t.toUpperCase());
    const drawnTags = async (st: Invoice["status"], number = "INV-2026-1") =>
      (await render({}, makeInvoice({ status: st, invoiceNumber: number }))).strings.filter((s) => tags.includes(s));
    for (const st of ["sent", "unpaid", "overdue", "partially_paid"] as const) {
      expect([st, await drawnTags(st)]).toEqual([st, ["KIÁLLÍTVA"]]);
    }
    expect(await drawnTags("paid")).toEqual([status.paid.toUpperCase()]);
    expect(await drawnTags("cancelled")).toEqual([status.cancelled.toUpperCase()]);
    expect(await drawnTags("draft", "")).toEqual([status.draft.toUpperCase()]);
  });

  it("draws the Piszkozat watermark only on an unnumbered draft, rotated -24 deg at 7 % opacity", async () => {
    const draft = await render({}, makeInvoice({ status: "draft", invoiceNumber: "" }));
    expect(draft.rotations).toEqual([-24]);
    expect(draft.fillOpacities).toContain(0.07);
    const marks = draft.texts.filter((t) => t.text === "Piszkozat" && t.fontSize > 60);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.fontSize).toBeCloseTo(px(79), 2);

    for (const invoice of [makeInvoice({ status: "sent" }), makeInvoice({ status: "paid" }), makeInvoice({ status: "draft", invoiceNumber: "INV-2026-5" })]) {
      const r = await render({}, invoice);
      expect(r.rotations).toHaveLength(0);
    }
  });

  it("draws the watermark on every page of a multi-page draft", async () => {
    const draft = { ...many(40), status: "draft" as const, invoiceNumber: "" };
    const r = await render({}, draft);
    expect(r.pageCount).toBeGreaterThan(1);
    expect(r.rotations).toHaveLength(r.pageCount);
    expect(r.texts.filter((t) => t.text === "Piszkozat" && t.fontSize > 60)).toHaveLength(r.pageCount);
  });

  it("prints the footer text, the attribution (no brand mark) on every page and the page indicator only when multi-page", async () => {
    const single = await render();
    expect(single.strings.filter((s) => s === "Köszönjük a bizalmát!")).toHaveLength(1);
    expect(single.strings.filter((s) => /^\d+\/\d+\. oldal$/.test(s))).toHaveLength(0);

    const multi = await render({}, many(40));
    expect(multi.pageCount).toBe(3);
    expect(multi.strings.filter((s) => s === "Köszönjük a bizalmát!")).toHaveLength(3);
    expect(multi.strings.filter((s) => s === "Készült az InvoHub-bal · invohub.hu")).toHaveLength(3);
    expect(multi.strings.filter((s) => /^\d+\/3\. oldal$/.test(s)).sort()).toEqual(["1/3. oldal", "2/3. oldal", "3/3. oldal"]);
    // text only: the attribution is drawn in the muted document ink, at the right edge
    const attribution = multi.texts.find((t) => t.text === "Készült az InvoHub-bal · invohub.hu")!;
    expect(attribution.color.toLowerCase()).toBe("#5b6178");
  });

  it("pins the footer to the bottom edge of every page", async () => {
    const r = await render({}, many(40));
    const footers = r.texts.filter((t) => t.text === "Köszönjük a bizalmát!");
    for (const f of footers) expect(f.y).toBeGreaterThan(790);
  });
});

describe("renderPaperPdf: pagination", () => {
  it("one page for the sample in every layout and font", async () => {
    for (const layout of ["clean", "band", "frame"] as PdfLayout[]) {
      for (const fontStyle of ["invohub", "classic", "round"] as const) {
        const r = await render({ layout, fontStyle });
        expect([layout, fontStyle, r.pageCount]).toEqual([layout, fontStyle, 1]);
      }
    }
  });

  it("opens each continuation page with the banner, repeats the table header, and never leaves a blank page", async () => {
    const r = await render({}, many(40));
    expect(r.pageCount).toBe(3);
    const banners = r.strings.filter((s) => s === "INV-2026-00099 · folytatás");
    expect(banners).toHaveLength(2);
    expect(r.strings.filter((s) => s === "MEGNEVEZÉS")).toHaveLength(2); // pages 1 and 2
    for (let page = 0; page < r.pageCount; page += 1) {
      expect(r.texts.some((t) => t.page === page && t.y < 800)).toBe(true);
    }
  });

  it("repeats a caption for continued notes", async () => {
    const r = await render({}, makeInvoice({ notes: "Hosszú megjegyzés. ".repeat(400) }));
    expect(r.pageCount).toBeGreaterThan(1);
    expect(r.strings.some((s) => /\(FOLYTATÁS\)$/.test(s))).toBe(true);
  });
});

describe("renderPaperPdf: the meta strip is one row, in every font style", () => {
  const FONT_STYLES = ["invohub", "classic", "round"] as const;
  const eur = makeInvoice({
    invoiceNumber: "INV-2026-7",
    currency: "EUR",
    exchangeRate: 395.5,
    fulfillmentDate: "2026-06-01",
    paymentMethod: "transfer",
  });

  it.each(FONT_STYLES)("%s: five cells (sample) and six cells (EUR + MNB rate) sit on a single row of captions", async (fontStyle) => {
    for (const [invoice, count] of [[buildSamplePreviewInvoice(), 5], [eur, 6]] as const) {
      const r = await render({ layout: "frame", fontStyle }, invoice);
      const captions = ["Kiállítás kelte", "Fizetési határidő", "Fizetési mód", "Pénznem", "Árfolyam"]
        .map((label) => textOf(r, label.toUpperCase()) ?? textOf(r, label))
        .filter((t): t is NonNullable<typeof t> => !!t);
      expect(captions.length).toBeGreaterThanOrEqual(count === 5 ? 4 : 5);
      const ys = new Set(captions.map((t) => Math.round(t.y)));
      expect({ fontStyle, count, rows: ys.size }).toEqual({ fontStyle, count, rows: 1 });
    }
  });

  it("a date value does not wrap in the six-cell strip", async () => {
    const r = await render({ layout: "frame" }, eur);
    const dates = r.strings.filter((s) => /^2026\. \d\d\. \d\d\.$/.test(s));
    expect(dates.length).toBeGreaterThanOrEqual(2);
  });
});

describe("renderPaperPdf: the issuer's bank account stays on one line in Keretes", () => {
  it.each(["invohub", "classic", "round"] as const)("%s", async (fontStyle) => {
    const r = await render({ layout: "frame", fontStyle });
    const bank = r.strings.filter((s) => s.startsWith("Bankszámlaszám: "));
    expect(bank).toEqual(["Bankszámlaszám: 10700024-12345678-51100005"]);
  });
});

describe("renderPaperPdf: pasted typography the fonts lack is normalised", () => {
  it("prints a non-breaking hyphen as a hyphen and drops zero-width characters", async () => {
    const r = await render(
      {},
      makeInvoice({
        invoiceNumber: "INV-2026-8",
        clientName: "Dél\u2011Pest\u200B Kft.",
        notes: "határidő\u202F15\u2011én",
        lineItems: [makeLineItem({ id: "a", description: "Web\u2011fejlesztés", quantity: 1, unitPrice: 1000 })],
      })
    );
    const all = r.strings.join("\n");
    expect(all).not.toMatch(/[\u2011\u200B\u202F]/);
    expect(all).toContain("Web-fejlesztés");
    expect(all).toContain("Dél-Pest Kft.");
  });
});
