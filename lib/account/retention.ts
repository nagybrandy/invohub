// lib/account/retention.ts
// Pure retention-period rules for issued documents of a closed account.
// No DB / better-auth imports so it can be unit tested in isolation.
//
// Legal basis (verified 2026-09-22 — full citations and caveats in
// docs/decisions/2026-09-22-invoice-retention-on-account-deletion.md):
//  - Áfa tv. (2007. évi CXXVII.) 179. § (1): whoever issues an invoice must
//    keep it at least until the right to assess the tax lapses
//    ("az adó megállapításához való jog elévüléséig").
//  - Art. (2017. évi CL.) 202. § (1): that right lapses 5 years after the
//    last day of the calendar year in which the return/data supply was due.
//  - Számv. tv. (2000. évi C.) 169. § (2): documents supporting the books
//    must be kept "legalább 8 évig" — applies to entities under Számv. tv.
//    (NOT to egyéni vállalkozók, 2. § (3)), but some InvoHub users are
//    companies, and 8 years always covers the 5(+1)-year Art. window, so we
//    apply 8 years to everyone as the conservative superset.
//  - GDPR Art. 17(3)(b): erasure may be refused where processing is required
//    by a legal obligation — which is why closure keeps these rows.

/** Years issued documents are kept, counted from the end of the issue year. */
export const INVOICE_RETENTION_YEARS = 8;

function yearOf(value: string | Date): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getUTCFullYear();
  }
  const match = /^(\d{4})/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Last moment a document issued on `issueDate` must still be retained:
 * 23:59:59.999 UTC on 31 December of (issue year + 8).
 */
export function retentionEndForIssueDate(issueDate: string | Date): Date {
  const year = yearOf(issueDate);
  if (year === null) throw new Error(`Invalid issue date: ${String(issueDate)}`);
  return new Date(Date.UTC(year + INVOICE_RETENTION_YEARS, 11, 31, 23, 59, 59, 999));
}

/**
 * Retention end for a whole closed account: the latest of every retained
 * document's retention end, floored at the closure year (conservative — a
 * document dated later than closure, or one we failed to see, is still
 * covered as long as it was issued no later than the closure year).
 */
export function accountRetentionUntil(
  issueDates: ReadonlyArray<string | Date | null | undefined>,
  closedAt: Date
): Date {
  let latestYear = closedAt.getUTCFullYear();
  for (const d of issueDates) {
    if (d == null) continue;
    const y = yearOf(d);
    if (y !== null && y > latestYear) latestYear = y;
  }
  return new Date(Date.UTC(latestYear + INVOICE_RETENTION_YEARS, 11, 31, 23, 59, 59, 999));
}

/** Login e-mail placeholder for a closed account — `.invalid` is reserved (RFC 2606). */
export function closedAccountEmail(userId: string): string {
  return `closed-${userId}@invalid`;
}

export const CLOSED_ACCOUNT_NAME = "Closed account";
