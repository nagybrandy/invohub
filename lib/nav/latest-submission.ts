// lib/nav/latest-submission.ts
// "The latest submission per invoice" — the one fact the list dot, the mobile
// card and the dashboard's NAV-failure count all need. The reduction is pure
// so it can be tested without a database; the loaders live in latest-submission-store.ts so this file never touches
// the database at import time (tests must not need one — AGENTS.md §9).

export type SubmissionStatusRow = { invoiceId: string; status: string; createdAt: Date | string };

/** Newest row wins per invoice, whatever order the rows arrive in. */
export function latestStatusByInvoice(rows: SubmissionStatusRow[]): Map<string, string> {
  const status = new Map<string, string>();
  const newest = new Map<string, number>();
  for (const row of rows) {
    const t = new Date(row.createdAt).getTime();
    const seen = newest.get(row.invoiceId);
    if (seen === undefined || t > seen) {
      newest.set(row.invoiceId, t);
      status.set(row.invoiceId, row.status);
    }
  }
  return status;
}
