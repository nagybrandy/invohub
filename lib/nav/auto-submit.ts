// lib/nav/auto-submit.ts
// Automatic NAV Online Számla submission when a számla-type document
// (invoice/advance/storno/helyesbítő) is finalized — called by every route
// that can finalize one. Never throws: the invoice save already succeeded,
// a NAV problem is recorded on the nav_submission row and surfaced on the
// invoice detail screen ("Újrapróbálás").
import { getCompanyByUserId, type Company } from "@/lib/companies/service";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";
import { hasOwnNavCredentials, isSharedNavTestAccountConfigured } from "@/lib/nav/resolve-credentials";
import { isNavReportableDocumentType } from "@/lib/nav/submission-guard";
import { serializeNavSubmission } from "@/lib/nav/serialize-submission";
import { submitOutgoingInvoiceToNav, type NavSubmitOutcome } from "@/lib/nav/submit-outgoing";

/**
 * NAV counts as configured when the user has a company profile and its
 * mode can actually submit: demo (simulator) always; test with the
 * company's own technical user or the shared InvoHub test account.
 * Production is deliberately excluded — automatic production reporting is
 * a separate, owner-signed-off decision (and production itself stays
 * behind NAV_PRODUCTION_ENABLED, lib/nav/environment.ts).
 */
export function isNavAutoSubmitConfigured(company: Company | null): boolean {
  if (!company) return false;
  const mode = company.navEnvironment ?? "demo";
  if (mode === "demo") return true;
  if (mode === "test") return hasOwnNavCredentials(company) || isSharedNavTestAccountConfigured();
  return false;
}

function isFinalized(invoice: Invoice): boolean {
  return invoice.status !== "draft" && hasInvoiceNumber(invoice);
}

/**
 * True only for the moment a reportable document becomes final: it was a
 * draft (or didn't exist — a storno is created final), and now has a number.
 * Editing an already-final document (mark paid, notes, …) never triggers it,
 * so legacy never-reported invoices are not suddenly sent on an unrelated edit.
 */
export function isFinalizationTransition(before: Invoice | null, after: Invoice): boolean {
  if (!isNavReportableDocumentType(after.documentType)) return false;
  if (!isFinalized(after)) return false;
  return before === null || !isFinalized(before);
}

export type NavAutoSubmitResult = {
  outcome: "submitted" | "existing" | "failed" | "rejected";
  submission: ReturnType<typeof serializeNavSubmission>;
  error?: string;
  code?: string;
};

export function toNavAutoSubmitResult(outcome: NavSubmitOutcome): NavAutoSubmitResult {
  switch (outcome.kind) {
    case "rejected":
      return { outcome: "rejected", submission: null, code: outcome.code };
    case "failed":
      return { outcome: "failed", submission: serializeNavSubmission(outcome.submission), error: outcome.error };
    default:
      return { outcome: outcome.kind, submission: serializeNavSubmission(outcome.submission) };
  }
}

export async function autoSubmitToNavOnFinalize(
  userId: string,
  before: Invoice | null,
  after: Invoice
): Promise<NavAutoSubmitResult | null> {
  if (!isFinalizationTransition(before, after)) return null;
  try {
    const company = await getCompanyByUserId(userId);
    if (!isNavAutoSubmitConfigured(company)) return null;

    return toNavAutoSubmitResult(await submitOutgoingInvoiceToNav(userId, after));
  } catch (error) {
    console.error("[nav auto-submit]", error);
    return {
      outcome: "failed",
      submission: null,
      error: error instanceof Error ? error.message : "NAV beküldés sikertelen.",
    };
  }
}
