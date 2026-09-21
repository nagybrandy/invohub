// lib/nav/reported-rate.ts
// Pure, I/O-free audit of a NAV submission's reported HUF exchange rate
// against the invoice as it stands today — and the resulting HUF amount
// difference. No NAV call, no database access; see
// docs/plans/2026-09-21-retro-correct-non-huf-invoices-nav-modify.md.
import { lineItemGrossTotal, lineItemNetTotal, lineItemVatAmount } from "@/lib/invoices/calculations";
import { resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

/**
 * The instant `lib/nav/invoice-xml.ts` stopped hardcoding `<exchangeRate>1
 * </exchangeRate>` for every non-HUF invoice — commit `7f926f7`
 * (2026-09-15 08:37:22 +0200, `slice/non-huf-invoice-exchange-rate-nav-xml`).
 * Converted to UTC: 08:37:22 +02:00 -> 06:37:22Z.
 *
 * A `nav_submission` row with `reportedExchangeRate: null` and
 * `submittedAt` (or `createdAt`, if the former is unset) strictly before
 * this instant was built by the pre-fix code path and is *known*, not
 * guessed, to have reported `exchangeRate` as `1` — see the module comment
 * this constant's callers read. A row at/after this instant with a null
 * reported rate came from the fixed builder, whose only way to write a null
 * `reportedExchangeRate` today is this slice not having recorded it yet
 * (e.g. a row inserted before this migration ran) — that case must not be
 * guessed either way, hence `"unknown"` rather than `"legacyImplicitOne"`.
 *
 * Deliberately conservative: this is the *commit* instant, not the
 * production *deploy* instant. If the deploy that shipped `7f926f7` lagged
 * behind the commit, a submission made in that gap would be misclassified
 * as `"ok"`/`"unknown"` instead of `"misreported"` — flagged as OQ-1 in the
 * plan for the human sign-off to confirm or widen.
 */
export const NAV_EXCHANGE_RATE_FIX_AT = "2026-09-15T06:37:22.000Z";

/** The subset of a `nav_submission` row the classifier needs. */
export type NavSubmissionAudit = {
  /** "demo" | "test" | "production" — a "demo" row never reached NAV. */
  mode: string;
  status: string;
  submittedAt: Date | string | null;
  createdAt: Date | string | null;
  reportedCurrency: string | null;
  /** Numeric string (formatExchangeRate form) or null for a pre-this-slice row. */
  reportedExchangeRate: string | number | null;
};

export type NavExchangeRateReportSource = "recorded" | "legacyImplicitOne";

export type NavExchangeRateReport =
  | { kind: "none" }
  | { kind: "ok" }
  | { kind: "unknown" }
  | {
      kind: "misreported";
      /** The rate NAV's copy of the invoice was built with. */
      reportedRate: number;
      /** The invoice's rate today, or null when it has none (item 10's state). */
      currentRate: number | null;
      source: NavExchangeRateReportSource;
    };

function submissionInstant(submission: NavSubmissionAudit): number {
  const value = submission.submittedAt ?? submission.createdAt;
  return value ? new Date(value).getTime() : Number.NaN;
}

/**
 * Picks the submission whose reported rate NAV actually holds today: the
 * latest by `submittedAt` among non-demo submissions (a demo submission
 * never reached NAV and has no tax consequence — filtered out first, never
 * allowed to "win" over an older real one).
 */
function latestNonDemoSubmission(submissions: NavSubmissionAudit[]): NavSubmissionAudit | null {
  const real = submissions.filter((s) => s.mode !== "demo");
  if (real.length === 0) return null;
  return real.reduce((latest, candidate) =>
    submissionInstant(candidate) > submissionInstant(latest) ? candidate : latest
  );
}

/**
 * Classifies whether NAV's copy of `invoice` (via its latest real
 * submission) still agrees with the invoice's current exchange rate. Pure
 * and conservative — never guesses a rate it can't prove (see
 * `NAV_EXCHANGE_RATE_FIX_AT`'s doc comment), never flags a correction
 * document, and a demo-only submission is invisible to it (AC2.2).
 */
export function classifyNavExchangeRateReport(
  invoice: Pick<Invoice, "currency" | "exchangeRate" | "documentType">,
  submissions: NavSubmissionAudit[]
): NavExchangeRateReport {
  if (invoice.currency === "HUF") return { kind: "none" };
  if (invoice.documentType === "storno" || invoice.documentType === "modify") {
    return { kind: "none" };
  }

  const submission = latestNonDemoSubmission(submissions);
  if (!submission) return { kind: "none" };

  const currentRateResolution = resolveExchangeRate(invoice);
  const currentRate = currentRateResolution.ok ? currentRateResolution.rate : null;

  if (submission.reportedExchangeRate === null || submission.reportedExchangeRate === undefined) {
    const instant = submissionInstant(submission);
    const isPreFix = Number.isFinite(instant) && instant < new Date(NAV_EXCHANGE_RATE_FIX_AT).getTime();
    if (!isPreFix) return { kind: "unknown" };
    return { kind: "misreported", reportedRate: 1, currentRate, source: "legacyImplicitOne" };
  }

  const reportedRate = Number(submission.reportedExchangeRate);
  if (currentRate !== null && reportedRate === currentRate) return { kind: "ok" };
  return { kind: "misreported", reportedRate, currentRate, source: "recorded" };
}

export type NavHufMisreportInput = {
  lineItems: InvoiceLineItem[];
  reportedRate: number;
  /** null when the invoice has no usable current rate (item 10's state). */
  currentRate: number | null;
};

export type NavHufMisreport = {
  reportedNetHuf: number;
  correctNetHuf: number | null;
  deltaNetHuf: number | null;
  reportedVatHuf: number;
  correctVatHuf: number | null;
  deltaVatHuf: number | null;
  reportedGrossHuf: number;
  correctGrossHuf: number | null;
  deltaGrossHuf: number | null;
};

/** Converts one line to HUF at `rate`, per-line (never on an already-summed total). */
function sumLinesToHuf(
  lineItems: InvoiceLineItem[],
  rate: number,
  amountOf: (line: InvoiceLineItem) => number
): number {
  return lineItems.reduce((sum, line) => sum + toHufAmount(amountOf(line), rate), 0);
}

/**
 * The arithmetic difference between what NAV was told (`reportedRate`) and
 * what the invoice's line items say today (`currentRate`) — net, VAT and
 * gross, each in HUF, converted per line then summed (AC3.3, matching
 * buildNavInvoiceXml's own summation order so the two numbers can never
 * disagree). No tax rule, rate source or rounding policy of its own beyond
 * `toHufAmount`'s existing 2-decimal rounding.
 */
export function computeNavHufMisreport({
  lineItems,
  reportedRate,
  currentRate,
}: NavHufMisreportInput): NavHufMisreport {
  const reportedNetHuf = sumLinesToHuf(lineItems, reportedRate, lineItemNetTotal);
  const reportedVatHuf = sumLinesToHuf(lineItems, reportedRate, lineItemVatAmount);
  const reportedGrossHuf = sumLinesToHuf(lineItems, reportedRate, lineItemGrossTotal);

  const hasCurrentRate = currentRate !== null;
  const correctNetHuf = hasCurrentRate ? sumLinesToHuf(lineItems, currentRate, lineItemNetTotal) : null;
  const correctVatHuf = hasCurrentRate ? sumLinesToHuf(lineItems, currentRate, lineItemVatAmount) : null;
  const correctGrossHuf = hasCurrentRate
    ? sumLinesToHuf(lineItems, currentRate, lineItemGrossTotal)
    : null;

  return {
    reportedNetHuf,
    correctNetHuf,
    deltaNetHuf: correctNetHuf === null ? null : correctNetHuf - reportedNetHuf,
    reportedVatHuf,
    correctVatHuf,
    deltaVatHuf: correctVatHuf === null ? null : correctVatHuf - reportedVatHuf,
    reportedGrossHuf,
    correctGrossHuf,
    deltaGrossHuf: correctGrossHuf === null ? null : correctGrossHuf - reportedGrossHuf,
  };
}
