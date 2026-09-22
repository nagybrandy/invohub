// lib/account/closure.ts
// "Account closure" — the ONLY supported way to delete an InvoHub account.
//
// Issued invoices (and the data needed to reproduce them) must be retained
// for 8 years from the end of the issue year (see lib/account/retention.ts
// and docs/decisions/2026-09-22-invoice-retention-on-account-deletion.md).
// Every FK from `user` cascades today, so hard-deleting the user row would
// destroy all of that. Closure therefore NEVER deletes the user row; it:
//   1. deletes what is not legally required (drafts, products, unreferenced
//      clients, API keys, sessions, credential/OAuth accounts, idempotency
//      keys, e-mail templates, notifications, payment reminder schedules),
//   2. wipes stored NAV technical-user credentials and e-mail delivery prefs,
//   3. anonymizes personal data the invoices don't need (login e-mail, name,
//      avatar, buyer e-mail on retained clients),
//   4. stamps user.closedAt / user.retentionUntil.
// Everything runs in one neon-http batch (a single transaction).
//
// KEPT: user row (anonymized), company (seller data on the invoices), every
// non-draft invoice + line items + nav_submission, clients referenced by a
// retained invoice (buyer data fallback for pre-snapshot invoices), receipts
// + line items + nav_receipt_submission, incoming invoices, document
// sequences (numbering continuity), the PDF template (document appearance).
//
// TODO(retention-purge): a scheduled job that, once `retentionUntil` has
// passed, deletes the retained rows (per document, 8 years after its own
// issue year) and finally the user row. Deliberately NOT implemented — needs
// owner + legal sign-off (see the ADR).
import { and, eq, isNotNull, max, ne, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  apiKey,
  client,
  company,
  emailTemplate,
  idempotencyKey,
  invoice,
  notification,
  paymentReminderSchedule,
  product,
  receipt,
  session,
  user,
  verification,
} from "@/db/schema";
import {
  accountRetentionUntil,
  CLOSED_ACCOUNT_NAME,
  closedAccountEmail,
} from "@/lib/account/retention";

type Database = typeof db;

export type ClosureInput = {
  userId: string;
  /** The login e-mail before anonymization (used to clear verification rows). */
  previousEmail: string;
  now: Date;
  retentionUntil: Date;
};

/**
 * Builds (does not run) the ordered closure statements. Kept separate from
 * closeAccount so tests can assert the exact SQL via drizzle.mock().
 * Order matters: drafts go first so the "unreferenced client" subquery no
 * longer sees them.
 */
export function buildClosureStatements(database: Database, input: ClosureInput) {
  const { userId, previousEmail, now, retentionUntil } = input;

  const retainedClientIds = database
    .select({ id: invoice.clientId })
    .from(invoice)
    .where(and(eq(invoice.userId, userId), isNotNull(invoice.clientId)));

  return [
    // 1. Drafts are not issued documents — no retention duty. Their line
    //    items / nav_submission / reminder rows go via ON DELETE CASCADE.
    database
      .delete(invoice)
      .where(and(eq(invoice.userId, userId), eq(invoice.status, "draft"))),
    database.delete(paymentReminderSchedule).where(eq(paymentReminderSchedule.userId, userId)),
    database.delete(apiKey).where(eq(apiKey.userId, userId)),
    database.delete(session).where(eq(session.userId, userId)),
    // Credential (password hash) + OAuth token rows: removing them makes a
    // sign-in impossible even before the session-create guard runs.
    database.delete(account).where(eq(account.userId, userId)),
    database
      .delete(verification)
      .where(or(eq(verification.identifier, previousEmail), eq(verification.value, userId))),
    database.delete(idempotencyKey).where(eq(idempotencyKey.userId, userId)),
    database.delete(emailTemplate).where(eq(emailTemplate.userId, userId)),
    database.delete(notification).where(eq(notification.userId, userId)),
    // Line items snapshot description/price/VAT, so the product catalogue
    // is not needed to reproduce any invoice.
    database.delete(product).where(eq(product.userId, userId)),
    database
      .delete(client)
      .where(and(eq(client.userId, userId), notInArray(client.id, retainedClientIds))),
    // Buyer e-mail is never printed on an invoice (Áfa tv. 169. §).
    database
      .update(client)
      .set({ email: null, updatedAt: now })
      .where(eq(client.userId, userId)),
    database
      .update(company)
      .set({
        navTechnicalUser: null,
        navTechnicalPassword: null,
        navXmlSignKey: null,
        navXmlChangeKey: null,
        invoiceEmailTo: null,
        invoiceEmailCc: null,
        updatedAt: now,
      })
      .where(eq(company.userId, userId)),
    database
      .update(user)
      .set({
        email: closedAccountEmail(userId),
        name: CLOSED_ACCOUNT_NAME,
        emailVerified: false,
        image: null,
        closedAt: now,
        retentionUntil,
        updatedAt: now,
      })
      .where(eq(user.id, userId)),
  ] as const;
}

export type CloseAccountResult =
  | { status: "not_found" }
  | { status: "already_closed"; closedAt: Date; retentionUntil: Date | null }
  | { status: "closed"; closedAt: Date; retentionUntil: Date };

export async function closeAccount(
  userId: string,
  now: Date = new Date()
): Promise<CloseAccountResult> {
  const [existing] = await db
    .select({ id: user.id, email: user.email, closedAt: user.closedAt, retentionUntil: user.retentionUntil })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!existing) return { status: "not_found" };
  if (existing.closedAt) {
    return {
      status: "already_closed",
      closedAt: existing.closedAt,
      retentionUntil: existing.retentionUntil ?? null,
    };
  }

  const [[latestInvoice], [latestReceipt]] = await Promise.all([
    db
      .select({ value: max(invoice.issueDate) })
      .from(invoice)
      .where(and(eq(invoice.userId, userId), ne(invoice.status, "draft"))),
    db
      .select({ value: max(receipt.issuedAt) })
      .from(receipt)
      .where(eq(receipt.userId, userId)),
  ]);

  const retentionUntil = accountRetentionUntil(
    [latestInvoice?.value, latestReceipt?.value],
    now
  );

  await db.batch(
    buildClosureStatements(db, {
      userId,
      previousEmail: existing.email,
      now,
      retentionUntil,
    })
  );

  return { status: "closed", closedAt: now, retentionUntil };
}

/** True when the user row is marked closed. Used by the sign-in guard. */
export async function isAccountClosed(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ closedAt: user.closedAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return Boolean(row?.closedAt);
}

// Re-exported for the export module so it filters exactly like closure does.
export const retainedInvoiceFilter = (userId: string) =>
  and(eq(invoice.userId, userId), ne(invoice.status, "draft"));
