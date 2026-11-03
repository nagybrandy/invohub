// lib/invoices/document-mandatory.test.ts
// The mandatory-content matrix (docs/design/invoice-paper-2026-11/PLAN.md §9.9).
// Every mandatory element of Áfa tv. 169. § and every existing document label
// must be DRAWN on every variant: all layouts (legacy, Letisztult, Sávos,
// Keretes) x font styles x logo modes x hu/en x document types, with the
// toggles all on and all off, plus the EUR / AAM / TAM / FAD / 40-line /
// long-notes scenarios. Real pdfkit; the strings are recorded as they are drawn.
/** @jest-environment node */
import { renderRecorded, normalizeDrawn } from "@/__tests__/helpers/pdf-recorder";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import {
  documentLabels,
  documentTitleFor,
  formatDocumentAmount,
  formatDocumentQuantity,
  formatPartyAddress,
  type DocumentLocale,
} from "@/lib/invoices/document-labels";
import { calculateInvoiceTotals, lineItemGrossTotal, lineItemNetTotal } from "@/lib/invoices/calculations";
import { formatDateOnly, formatInvoiceDueDate } from "@/lib/dates/format";
import type { InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE, localizePdfTemplate } from "@/lib/invoices/pdf-template/defaults";
import type {
  InvoicePdfTemplate,
  PdfFontStyle,
  PdfLayout,
  PdfLogoMode,
} from "@/lib/invoices/pdf-template/types";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import type { Invoice, InvoiceDocumentType } from "@/lib/invoices/types";

const PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const COMPANY = {
  name: "Kovács Anna e.v.",
  taxNumber: "66123456-1-33",
  address: "Bartók Béla út 21. 2/4.",
  city: "Budapest",
  zipCode: "1114",
  country: "Magyarország",
  bankAccount: "11773016-11111018-00000000",
};
const BUYER = { address: "Minta utca 12.", city: "Budapest", zipCode: "1117", country: "Magyarország" };

const LAYOUTS: PdfLayout[] = ["legacy", "clean", "band", "frame"];
const NEW_LAYOUTS: PdfLayout[] = ["clean", "band", "frame"];
const FONTS: PdfFontStyle[] = ["invohub", "classic", "round"];
const LOGOS: PdfLogoMode[] = ["monogram", "own", "none"];
const LOCALES: DocumentLocale[] = ["hu", "en"];
const TYPES: InvoiceDocumentType[] = ["invoice", "proforma", "advance", "storno", "modify"];

const toggles = (on: boolean) => ({ showCompanyBlock: on, showBankDetails: on, showClientTaxNumber: on });

function template(layout: PdfLayout, over: Partial<InvoicePdfTemplate> = {}): InvoicePdfTemplate {
  const base = layout === "legacy" ? LEGACY_PDF_TEMPLATE : DEFAULT_PDF_TEMPLATE;
  return { ...base, layout, ...over };
}

function invoiceFor(type: InvoiceDocumentType, locale: DocumentLocale, over: Partial<Invoice> = {}): Invoice {
  const negative = type === "storno" || type === "modify";
  return makeInvoice({
    invoiceNumber: "INV-2026-00042",
    documentType: type,
    language: locale,
    fulfillmentDate: "2026-05-30",
    paymentMethod: "transfer",
    clientName: "Tech Solutions Kft.",
    clientTaxNumber: "12345678-2-41",
    lineItems: [
      makeLineItem({ id: "a", description: "Webfejlesztés (óradíj)", quantity: negative ? -24 : 24, unit: "óra", unitPrice: 15000 }),
      makeLineItem({ id: "b", description: "Havi karbantartás", quantity: negative ? -1 : 1, unit: "hó", unitPrice: 45000, vatRate: 5 }),
    ],
    notes: "Fizetési határidő 15 nap.",
    ...over,
  });
}

type Expectation = { what: string; text: string };

/**
 * Everything the document must print for this context, derived from the RAW
 * invoice data with the shared formatters (never from a renderer).
 */
function expectedStrings(ctx: InvoicePdfContext, locale: DocumentLocale, layout: PdfLayout): Expectation[] {
  const { invoice, company, buyer } = ctx;
  const labels = documentLabels(locale);
  const intl = locale === "hu" ? "hu-HU" : "en-GB";
  const tpl = localizePdfTemplate(ctx.template!, locale);
  const isLegacy = layout === "legacy";
  const money = (n: number) => formatDocumentAmount(n, invoice.currency, locale);
  const out: Expectation[] = [];
  const add = (what: string, text: string | undefined) => {
    if (text) out.push({ what, text });
  };

  add("issuer name", company!.name);
  add("issuer tax number", `${labels.taxNumber}: ${company!.taxNumber}`);
  // Legacy only prints the full address in the Kibocsátó box (a pre-existing
  // gap, frozen with the renderer); the paper layouts always print it.
  if (!isLegacy || tpl.showCompanyBlock) add("issuer address", formatPartyAddress(company!));
  // Bank details: a user choice (not a 169. § element). Legacy prints the
  // account in the Kibocsátó box only; the paper layouts also in the payment strip.
  if (tpl.showBankDetails && (!isLegacy || tpl.showCompanyBlock)) {
    add("bank account", `${labels.bankAccount}: ${company!.bankAccount}`);
  }

  add("buyer name", invoice.clientName);
  add("buyer address", formatPartyAddress(buyer ?? {}));
  if (!isLegacy || tpl.showClientTaxNumber) add("buyer tax number", `${labels.taxNumber}: ${invoice.clientTaxNumber}`);
  add("buyer caption", labels.buyer);

  add(
    "title",
    invoice.documentType === "invoice" ? tpl.titleText : documentTitleFor(invoice.documentType, locale).toUpperCase()
  );
  add("number", invoice.invoiceNumber || labels.draftNumber);

  add("issue date label", labels.issueDate);
  add("issue date", formatDateOnly(invoice.issueDate, intl));
  if (invoice.fulfillmentDate) {
    add("fulfillment date label", labels.fulfillmentDate);
    add("fulfillment date", formatDateOnly(invoice.fulfillmentDate, intl));
  }
  add("due date label", labels.dueDate);
  add("due date", formatInvoiceDueDate(invoice, intl));
  add("currency label", labels.currency);
  add("currency", invoice.currency);

  for (const label of [labels.description, labels.quantity, labels.unitPrice, labels.net, labels.vat, labels.gross]) {
    add(`column ${label}`, label);
  }
  for (const item of invoice.lineItems) {
    add("row description", item.description);
    add("row quantity", formatDocumentQuantity(item.quantity, item.unit, locale));
    add("row unit price", money(item.unitPrice));
    add("row net", money(lineItemNetTotal(item)));
    add("row gross", money(lineItemGrossTotal(item)));
    add("row vat", item.vatCategory === "normal" ? `${item.vatRate}%` : item.vatCategory);
  }

  const totals = calculateInvoiceTotals(invoice.lineItems);
  add("net total label", labels.netTotal);
  add("net total", money(totals.subtotal));
  add("vat total label", labels.vatTotal);
  add("vat total", money(totals.vatTotal));
  add("due label", totals.totalAmount < 0 ? labels.refundTotal : labels.grossTotal);
  add("due value", money(totals.totalAmount));
  add("vat summary caption", labels.vatSummary);
  add("vat summary rate column", labels.vatRateColumn);
  add("vat summary amount column", labels.vatAmount);

  if (invoice.documentType === "storno" && ctx.referencedInvoiceNumber) {
    add("storno reference", labels.referenceStorno.replace("{{number}}", ctx.referencedInvoiceNumber));
  }
  if (invoice.documentType === "modify" && ctx.referencedInvoiceNumber) {
    add("modify reference", labels.referenceModify.replace("{{number}}", ctx.referencedInvoiceNumber));
  }
  for (const item of invoice.lineItems) {
    if (item.vatCategory !== "normal") {
      add("exemption reason", resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason) ?? undefined);
    }
  }
  if (invoice.notes) {
    add("notes", invoice.notes.slice(0, 40));
    add("notes label", tpl.notesLabel);
  }
  add("footer text", tpl.footerText);
  add("attribution", labels.footer);
  add("payment method label", invoice.paymentMethod ? labels.paymentMethod : undefined);
  add("payment method", invoice.paymentMethod ? labels.paymentMethods[invoice.paymentMethod] : undefined);
  return out;
}

async function missing(ctx: InvoicePdfContext, locale: DocumentLocale, layout: PdfLayout) {
  const recording = await renderRecorded(ctx);
  const drawn = recording.strings.map(normalizeDrawn).join("\n");
  const absent = expectedStrings(ctx, locale, layout)
    .filter((e) => !drawn.includes(normalizeDrawn(e.text)))
    .map((e) => `${e.what}: ${e.text}`);
  return { absent, recording, drawn };
}

function ctxFor(
  invoice: Invoice,
  tpl: InvoicePdfTemplate,
  extra: Partial<InvoicePdfContext> = {}
): InvoicePdfContext {
  return { invoice, company: COMPANY, buyer: BUYER, template: tpl, referencedInvoiceNumber: "INV-2026-00007", ...extra };
}

describe("mandatory content: layouts x fonts x logo modes x locales (sample document)", () => {
  const cases: Array<[PdfLayout, PdfFontStyle, PdfLogoMode, DocumentLocale]> = [];
  for (const layout of LAYOUTS) {
    for (const locale of LOCALES) {
      if (layout === "legacy") {
        cases.push([layout, "invohub", "monogram", locale]);
        continue;
      }
      for (const font of FONTS) for (const logo of LOGOS) cases.push([layout, font, logo, locale]);
    }
  }

  it.each(cases)("%s / %s / logo %s / %s prints everything", async (layout, font, logo, locale) => {
    const tpl = template(layout, { fontStyle: font, logoMode: logo, logoSize: "L", logoPosition: "right" });
    const ctx = ctxFor(invoiceFor("invoice", locale), tpl, {
      company: { ...COMPANY, logoUrl: logo === "own" ? PNG_DATA_URI : undefined },
    });
    const { absent } = await missing(ctx, locale, layout);
    expect(absent).toEqual([]);
  });
});

describe("mandatory content: layouts x document types x locales x toggles", () => {
  const cases: Array<[PdfLayout, InvoiceDocumentType, DocumentLocale, boolean]> = [];
  for (const layout of LAYOUTS)
    for (const type of TYPES) for (const locale of LOCALES) for (const on of [true, false]) cases.push([layout, type, locale, on]);

  it.each(cases)("%s / %s / %s / toggles %s", async (layout, type, locale, on) => {
    const tpl = template(layout, toggles(on));
    const ctx = ctxFor(invoiceFor(type, locale), tpl);
    const { absent } = await missing(ctx, locale, layout);
    expect(absent).toEqual([]);
  });
});

describe("new layouts never let a toggle hide mandatory content", () => {
  it.each(NEW_LAYOUTS)("%s prints the issuer address + tax number and the buyer tax number with all toggles off", async (layout) => {
    const ctx = ctxFor(invoiceFor("invoice", "hu"), template(layout, toggles(false)));
    const { drawn, recording } = await missing(ctx, "hu", layout);
    expect(drawn).toContain(normalizeDrawn("1114 Budapest, Bartók Béla út 21. 2/4."));
    expect(drawn).toContain(normalizeDrawn("Adószám: 66123456-1-33"));
    expect(drawn).toContain(normalizeDrawn("Adószám: 12345678-2-41"));
    // ...while the Kibocsátó box and the bank details really are hidden.
    expect(recording.strings).not.toContain("KIBOCSÁTÓ");
    expect(drawn).not.toContain(normalizeDrawn("11773016-11111018-00000000"));
  });

  it.each(NEW_LAYOUTS)("%s prints the buyer name even for a buyer without a tax number", async (layout) => {
    const ctx = ctxFor(invoiceFor("invoice", "hu", { clientTaxNumber: undefined }), template(layout));
    const { drawn } = await missing(ctx, "hu", layout);
    expect(drawn).toContain(normalizeDrawn("Tech Solutions Kft."));
  });
});

describe("mandatory content: scenario rows on all four layouts", () => {
  const scenario = (name: string, build: () => { invoice: Invoice; extra?: string[]; locale?: DocumentLocale }) =>
    describe(name, () => {
      it.each(LAYOUTS)("%s", async (layout) => {
        const { invoice, extra = [], locale = "hu" } = build();
        const ctx = ctxFor(invoice, template(layout));
        const { absent, drawn } = await missing(ctx, locale, layout);
        expect(absent).toEqual([]);
        for (const text of extra) expect([text, drawn.includes(normalizeDrawn(text))]).toEqual([text, true]);
      });
    });

  scenario("EUR invoice (Árfolyam, ÁFA összege forintban)", () => ({
    invoice: invoiceFor("invoice", "hu", { currency: "EUR", exchangeRate: 395.5 }),
    extra: ["Árfolyam", "1 EUR = 395,5 HUF", "ÁFA összege forintban"],
  }));
  scenario("EUR invoice in English", () => ({
    invoice: invoiceFor("invoice", "en", { currency: "EUR", exchangeRate: 395.5 }),
    locale: "en" as const,
    extra: ["Exchange rate", "1 EUR = 395,5 HUF", "VAT amount in HUF"],
  }));
  for (const category of ["AAM", "TAM", "FAD"] as const) {
    scenario(`${category} exemption / reverse-charge statement`, () => ({
      invoice: invoiceFor("invoice", "hu", {
        lineItems: [makeLineItem({ id: "x", vatCategory: category, vatRate: 0, description: "Szolgáltatás" })],
      }),
    }));
  }
  scenario("40 lines paginate with continuation banner, repeated header and page indicator", () => ({
    invoice: invoiceFor("invoice", "hu", {
      notes: "",
      lineItems: Array.from({ length: 40 }, (_, i) =>
        makeLineItem({ id: `l${i}`, description: `Tétel ${i + 1}`, quantity: 1, unitPrice: 5000 })
      ),
    }),
    extra: ["INV-2026-00042 · folytatás", "1/3. oldal", "Megnevezés"],
  }));
  scenario("long notes continue on the next page under a repeated label", () => ({
    invoice: invoiceFor("invoice", "hu", {
      notes: "Ez egy hosszú, ismétlődő szöveg a tördelés teszteléséhez. ".repeat(150),
    }),
    extra: ["INV-2026-00042 · folytatás", "(folytatás)"],
  }));
});

describe("parity: the paper layouts draw the same mandatory strings as legacy", () => {
  it.each(NEW_LAYOUTS)("%s equals legacy for the same documents (toggles on)", async (layout) => {
    for (const type of TYPES) {
      const invoice = invoiceFor(type, "hu");
      const legacy = await missing(ctxFor(invoice, template("legacy")), "hu", "legacy");
      const paper = await missing(ctxFor(invoice, template(layout)), "hu", layout);
      expect([type, legacy.absent]).toEqual([type, []]);
      expect([type, paper.absent]).toEqual([type, []]);
    }
  });

  it("every normalized string legacy prints from the document content is also drawn by the paper layouts", async () => {
    const invoice = invoiceFor("invoice", "hu", { currency: "EUR", exchangeRate: 395.5 });
    const legacy = new Set((await renderRecorded(ctxFor(invoice, template("legacy")))).strings.map(normalizeDrawn));
    const paper = (await renderRecorded(ctxFor(invoice, template("frame")))).strings.map(normalizeDrawn).join("\n");
    // Labels / values that are the document's content (not legacy-only
    // composites such as the "city  ·  Adószám" header line or the brand mark).
    const legacyOnlyComposites = (s: string) =>
      s.includes(" · ") || s.length < 2 || s === normalizeDrawn(LEGACY_PDF_TEMPLATE.footerText); // the two default footers differ by design
    const lost = [...legacy].filter((s) => !legacyOnlyComposites(s)).filter((s) => !paper.includes(s));
    expect(lost).toEqual([]);
  });
});
