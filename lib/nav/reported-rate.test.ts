// lib/nav/reported-rate.test.ts
// Pure classifier for "did we report the right HUF exchange rate to NAV for
// this invoice" (AC2) plus the arithmetic for how wrong the HUF VAT/net/
// gross amounts were (AC3). No I/O, no mocks — plain objects only.
// docs/plans/2026-09-21-retro-correct-non-huf-invoices-nav-modify.md
import {
  buildNavExchangeRateAudit,
  classifyNavExchangeRateReport,
  computeNavHufMisreport,
  NAV_EXCHANGE_RATE_FIX_AT,
  type NavSubmissionAudit,
} from "@/lib/nav/reported-rate";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const BEFORE_FIX = "2026-09-10T00:00:00.000Z";
const AFTER_FIX = "2026-09-16T00:00:00.000Z";

function makeSubmission(overrides: Partial<NavSubmissionAudit> = {}): NavSubmissionAudit {
  return {
    mode: "test",
    status: "done",
    submittedAt: AFTER_FIX,
    createdAt: AFTER_FIX,
    reportedCurrency: "EUR",
    reportedExchangeRate: "398.5",
    ...overrides,
  };
}

describe("NAV_EXCHANGE_RATE_FIX_AT", () => {
  it("is a valid UTC ISO instant", () => {
    expect(Number.isNaN(new Date(NAV_EXCHANGE_RATE_FIX_AT).getTime())).toBe(false);
    expect(NAV_EXCHANGE_RATE_FIX_AT.endsWith("Z")).toBe(true);
  });
});

describe("classifyNavExchangeRateReport", () => {
  it("2.1 — no submissions at all → none", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });
    expect(classifyNavExchangeRateReport(invoice, [])).toEqual({ kind: "none" });
  });

  it("2.2 — only demo submissions → none (a demo submission never reached NAV)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });
    const submissions = [makeSubmission({ mode: "demo", reportedExchangeRate: "1" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "none" });
  });

  it("2.3 — a HUF invoice → none, whatever the submissions say", () => {
    const invoice = makeInvoice({ currency: "HUF" });
    const submissions = [makeSubmission({ reportedCurrency: "HUF", reportedExchangeRate: "1" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "none" });
  });

  it("2.4 — recorded rate equal to the invoice's rate → ok", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });
    const submissions = [makeSubmission({ reportedExchangeRate: "398.5" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "ok" });
  });

  it("2.5 — recorded rate differs from the invoice's current rate → misreported (recorded)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 410 });
    const submissions = [makeSubmission({ reportedExchangeRate: "398.5" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({
      kind: "misreported",
      reportedRate: 398.5,
      currentRate: 410,
      source: "recorded",
    });
  });

  it("2.6 — null recorded rate, submitted before the fix instant → misreported (legacyImplicitOne)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 410 });
    const submissions = [
      makeSubmission({ reportedExchangeRate: null, submittedAt: BEFORE_FIX, createdAt: BEFORE_FIX }),
    ];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({
      kind: "misreported",
      reportedRate: 1,
      currentRate: 410,
      source: "legacyImplicitOne",
    });
  });

  it("2.7 — null recorded rate, submitted after the fix instant → unknown (never a guess)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 410 });
    const submissions = [
      makeSubmission({ reportedExchangeRate: null, submittedAt: AFTER_FIX, createdAt: AFTER_FIX }),
    ];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "unknown" });
  });

  it("2.8 — a storno document → none (a correction document is not the thing being corrected)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 410, documentType: "storno" });
    const submissions = [makeSubmission({ reportedExchangeRate: "398.5" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "none" });
  });

  it("2.8b — a modify (helyesbítő) document → none", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 410, documentType: "modify" });
    const submissions = [makeSubmission({ reportedExchangeRate: "398.5" })];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "none" });
  });

  it("2.9 — missing current rate + pre-fix non-demo submission → misreported, currentRate null", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: undefined });
    const submissions = [
      makeSubmission({ reportedExchangeRate: null, submittedAt: BEFORE_FIX, createdAt: BEFORE_FIX }),
    ];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({
      kind: "misreported",
      reportedRate: 1,
      currentRate: null,
      source: "legacyImplicitOne",
    });
  });

  it("2.10 — several submissions: the latest non-demo one by submittedAt decides, demo rows filtered first", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });
    const submissions = [
      makeSubmission({ submittedAt: "2026-09-17T00:00:00.000Z", reportedExchangeRate: "1" }), // oldest non-demo, wrong
      makeSubmission({
        mode: "demo",
        submittedAt: "2026-09-20T00:00:00.000Z",
        reportedExchangeRate: "999",
      }), // most recent overall, but demo — must be ignored
      makeSubmission({ submittedAt: "2026-09-18T00:00:00.000Z", reportedExchangeRate: "398.5" }), // latest non-demo, correct
    ];
    expect(classifyNavExchangeRateReport(invoice, submissions)).toEqual({ kind: "ok" });
  });
});

describe("computeNavHufMisreport", () => {
  it("3.1/3.2 — reported vs. correct HUF net/VAT/gross, one 100 EUR net line @ 27%", () => {
    const lineItems = [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" })];

    const result = computeNavHufMisreport({ lineItems, reportedRate: 1, currentRate: 400 });

    expect(result.reportedVatHuf).toBe(27);
    expect(result.correctVatHuf).toBe(10800);
    expect(result.deltaVatHuf).toBe(10773);
    expect(result.reportedNetHuf).toBe(100);
    expect(result.correctNetHuf).toBe(40000);
    expect(result.deltaNetHuf).toBe(39900);
    expect(result.reportedGrossHuf).toBe(127);
    expect(result.correctGrossHuf).toBe(50800);
    expect(result.deltaGrossHuf).toBe(50673);
  });

  it("3.3 — converts per line, then sums (rounds differently than rate × an already-summed total)", () => {
    // Two lines whose net totals are 0.333 each (document currency). Per
    // line then summed: round(0.333*1*100)/100 = 0.33 each -> sum 0.66.
    // Summed-first (the thing this must NOT do): (0.333+0.333)*1 = 0.666,
    // rounded to 0.67 — a different number. VAT rate 0 keeps this isolated
    // to the net/gross columns.
    const lineItems = [
      makeLineItem({ id: "l1", quantity: 1, unitPrice: 0.333, vatRate: 0, vatCategory: "normal" }),
      makeLineItem({ id: "l2", quantity: 1, unitPrice: 0.333, vatRate: 0, vatCategory: "normal" }),
    ];

    const result = computeNavHufMisreport({ lineItems, reportedRate: 1, currentRate: 1 });

    expect(result.reportedNetHuf).toBe(0.66);
    expect(result.reportedNetHuf).not.toBe(0.67);
  });

  it("3.4 — currentRate null → correct/delta fields are all null, reported fields still computed", () => {
    const lineItems = [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" })];

    const result = computeNavHufMisreport({ lineItems, reportedRate: 1, currentRate: null });

    expect(result.reportedVatHuf).toBe(27);
    expect(result.correctVatHuf).toBeNull();
    expect(result.deltaVatHuf).toBeNull();
    expect(result.correctNetHuf).toBeNull();
    expect(result.deltaNetHuf).toBeNull();
    expect(result.correctGrossHuf).toBeNull();
    expect(result.deltaGrossHuf).toBeNull();
  });

  it("exempt (AAM) lines report zero VAT at both rates", () => {
    const lineItems = [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 0, vatCategory: "AAM" })];

    const result = computeNavHufMisreport({ lineItems, reportedRate: 1, currentRate: 400 });

    expect(result.reportedVatHuf).toBe(0);
    expect(result.correctVatHuf).toBe(0);
    expect(result.deltaVatHuf).toBe(0);
  });

  it("gross === net + VAT, matching buildNavInvoiceXml's own summation order, even where an independently-rounded per-line gross would disagree", () => {
    // net=1.0003, vat=0.270081 @ rate 398.53: toHufAmount(net,rate)=398.65,
    // toHufAmount(vat,rate)=107.64, sum=506.29 — but toHufAmount(net+vat,
    // rate) (the old, wrong per-line-gross approach) rounds to 506.28. This
    // is the invoice-xml.ts divergence this function must not reintroduce.
    const lineItems = [makeLineItem({ quantity: 1, unitPrice: 1.0003, vatRate: 27, vatCategory: "normal" })];

    const result = computeNavHufMisreport({ lineItems, reportedRate: 398.53, currentRate: 398.53 });

    expect(result.reportedNetHuf).toBe(398.65);
    expect(result.reportedVatHuf).toBe(107.64);
    expect(result.reportedGrossHuf).toBe(result.reportedNetHuf + result.reportedVatHuf);
    expect(result.reportedGrossHuf).toBeCloseTo(506.29, 8);
    expect(result.reportedGrossHuf).not.toBeCloseTo(506.28, 8); // the old, independently-rounded figure
    expect(result.correctGrossHuf).toBe(result.correctNetHuf! + result.correctVatHuf!);
  });
});

describe("buildNavExchangeRateAudit", () => {
  it("sources reportedVatHuf from the winning submission's persisted column, not a recomputation from the invoice's (possibly since-edited) current line items", () => {
    // The invoice's line items today would recompute a *different* reported
    // VAT (100 EUR net @ 27% -> 27 HUF at rate 1) than what NAV's copy
    // actually held at submission time (the persisted column says 55).
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 400,
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" })],
    });
    const submissions = [makeSubmission({ reportedExchangeRate: "1", reportedVatHuf: "55" })];

    const result = buildNavExchangeRateAudit(invoice, submissions);

    expect(result.kind).toBe("misreported");
    expect((result as { reportedVatHuf: number }).reportedVatHuf).toBe(55);
    // deltaVatHuf follows the persisted figure, not the stale recomputed one.
    expect((result as { correctVatHuf: number }).correctVatHuf).toBe(10800);
    expect((result as { deltaVatHuf: number }).deltaVatHuf).toBe(10745);
  });

  it("falls back to the lineItems-based recomputation for a legacy row with no persisted reportedVatHuf", () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 400,
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" })],
    });
    const submissions = [
      makeSubmission({
        reportedExchangeRate: null,
        submittedAt: BEFORE_FIX,
        createdAt: BEFORE_FIX,
        reportedVatHuf: null,
      }),
    ];

    const result = buildNavExchangeRateAudit(invoice, submissions);

    expect(result.kind).toBe("misreported");
    expect((result as { reportedVatHuf: number }).reportedVatHuf).toBe(27);
  });

  it("passes through none/ok/unknown unchanged", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });
    expect(buildNavExchangeRateAudit(invoice, [])).toEqual({ kind: "none" });
  });
});
