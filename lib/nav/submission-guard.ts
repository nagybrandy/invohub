// lib/nav/submission-guard.ts
// Pure rules for "may this document be sent to NAV (again)?" — shared by
// the manual submit routes and the automatic submit-on-finalize path so the
// two can never drift apart.
import { isMissingExchangeRate } from "@/lib/invoices/exchange-rate";
import { hasInvoiceNumber, type Invoice, type InvoiceDocumentType } from "@/lib/invoices/types";

/** Számla-type documents. A díjbekérő (proforma) is not an invoice under the Áfa tv. — never reported. */
const REPORTABLE_DOCUMENT_TYPES: ReadonlySet<InvoiceDocumentType> = new Set([
  "invoice",
  "advance",
  "storno",
  "modify",
]);

export function isNavReportableDocumentType(documentType: InvoiceDocumentType): boolean {
  return REPORTABLE_DOCUMENT_TYPES.has(documentType);
}

/**
 * Statuses that mean "already on its way to / accepted by NAV" — another
 * submission would report the same invoice number twice. `pending` is our
 * own claim row (written before the network call); the rest are NAV
 * transaction states lower-cased by /api/nav/status. `error` (our own
 * failure record) and `aborted` (NAV rejected it) allow a retry.
 */
const IN_PROGRESS_STATUSES = new Set(["pending", "sent", "received", "processing", "saved"]);
const DONE_STATUS = "done";

export function isInProgressNavStatus(status: string): boolean {
  return IN_PROGRESS_STATUSES.has(status.toLowerCase());
}

export function isBlockingNavStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === DONE_STATUS || IN_PROGRESS_STATUSES.has(normalized);
}

/** A `pending` claim older than this is treated as a crashed request, not an in-flight one. */
export const STALE_PENDING_MS = 5 * 60 * 1000;

export type NavSubmittableCheck =
  | { ok: true }
  | {
      ok: false;
      code: "draftNotSubmittable" | "proformaNotSubmittable" | "missingExchangeRate";
      httpStatus: 409 | 422;
    };

export function checkNavSubmittable(invoice: Invoice): NavSubmittableCheck {
  if (invoice.status === "draft" || !hasInvoiceNumber(invoice)) {
    return { ok: false, code: "draftNotSubmittable", httpStatus: 409 };
  }
  if (!isNavReportableDocumentType(invoice.documentType)) {
    return { ok: false, code: "proformaNotSubmittable", httpStatus: 422 };
  }
  if (isMissingExchangeRate(invoice)) {
    return { ok: false, code: "missingExchangeRate", httpStatus: 409 };
  }
  return { ok: true };
}

type SubmissionLike = { id: string; status: string; createdAt: Date | string };

/**
 * The submission that blocks a new one, if any: the OLDEST in-progress or
 * done row (ties broken by id). Picking the oldest makes a race between two
 * concurrent claims deterministic — both see the same winner, the loser
 * backs off.
 */
export function pickBlockingSubmission<T extends SubmissionLike>(rows: T[], now: Date = new Date()): T | null {
  const blocking = rows.filter((row) => {
    if (!isBlockingNavStatus(row.status)) return false;
    if (row.status.toLowerCase() === "pending") {
      return now.getTime() - new Date(row.createdAt).getTime() <= STALE_PENDING_MS;
    }
    return true;
  });
  if (blocking.length === 0) return null;
  return blocking.sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}
