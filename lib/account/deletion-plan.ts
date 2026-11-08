// lib/account/deletion-plan.ts
// PURE description of what account closure would do to each table. It is a
// plan for display and review — it does no I/O, imports nothing from "@/db",
// and is NOT wired to any route, job or cron (a test enforces that). The
// executable closure remains lib/account/closure.ts (admin-only, existing).
//
// Every `legalConfirm: true` entry is a legal judgement that a Hungarian
// lawyer / tax professional must confirm; see
// docs/decisions/2026-11-08-self-serve-account-deletion.md.
import { accountRetentionUntil } from "@/lib/account/retention";

export type ClassificationAction = "retain" | "anonymise" | "delete" | "split" | "not-account-data";

export type TableClassification = {
  action: ClassificationAction;
  /** True when the decision is a legal judgement awaiting lawyer confirmation. */
  legalConfirm: boolean;
  note: string;
};

/** One decision per table in db/schema.ts (a test fails if a table has none). */
export const ACCOUNT_DATA_CLASSIFICATION: Record<string, TableClassification> = {
  user: { action: "anonymise", legalConfirm: false, note: "e-mail, name, image replaced; row kept as FK anchor, never hard-deleted." },
  session: { action: "delete", legalConfirm: false, note: "Login sessions." },
  account: { action: "delete", legalConfirm: false, note: "Password hash / OAuth tokens; sign-in becomes impossible." },
  verification: { action: "delete", legalConfirm: false, note: "E-mail verification / reset tokens." },
  company: { action: "retain", legalConfirm: true, note: "Seller data as printed on retained invoices; NAV technical credentials and invoice e-mail prefs wiped." },
  client: { action: "split", legalConfirm: true, note: "Kept only when a retained invoice references it (buyer e-mail cleared); otherwise deleted." },
  product: { action: "delete", legalConfirm: false, note: "Line items snapshot description, price and VAT." },
  invoice: { action: "split", legalConfirm: true, note: "Issued invoices (incl. storno / helyesbítő) retained; drafts deleted." },
  invoice_line_item: { action: "retain", legalConfirm: true, note: "Retained with its invoice; draft items go with the draft." },
  document_sequence: { action: "retain", legalConfirm: true, note: "Numbering continuity evidence." },
  nav_submission: { action: "retain", legalConfirm: true, note: "NAV transaction ids / answers for issued invoices." },
  invoice_pdf_template: { action: "retain", legalConfirm: false, note: "Appearance of issued documents." },
  email_template: { action: "delete", legalConfirm: false, note: "User-authored e-mail texts." },
  payment_reminder_schedule: { action: "delete", legalConfirm: false, note: "Reminder schedules." },
  incoming_invoice: { action: "retain", legalConfirm: true, note: "Received (cost) invoices; lawyer to decide retain vs export-then-delete." },
  receipt: { action: "retain", legalConfirm: true, note: "Nyugta." },
  receipt_line_item: { action: "retain", legalConfirm: true, note: "Retained with its receipt." },
  nav_receipt_submission: { action: "retain", legalConfirm: true, note: "Daily NAV receipt reports." },
  notification: { action: "delete", legalConfirm: false, note: "In-app notifications." },
  api_key: { action: "delete", legalConfirm: false, note: "Integration keys." },
  idempotency_key: { action: "delete", legalConfirm: false, note: "Replay store." },
  exchange_rate: { action: "not-account-data", legalConfirm: false, note: "Shared public MNB rates." },
  workspace_access: { action: "delete", legalConfirm: false, note: "Grants into and out of the account." },
  workspace_invite: { action: "delete", legalConfirm: false, note: "Invitations (contain e-mail addresses)." },
  company_directory: { action: "not-account-data", legalConfirm: false, note: "Shared public NAV taxpayer registry cache." },
  account_deletion_request: { action: "retain", legalConfirm: true, note: "Record of who asked and when; retention period to be confirmed." },
};

export type ClosurePlanInput = {
  closedAt: Date;
  invoices: ReadonlyArray<{ id: string; status: string; issueDate: string | Date | null; clientId: string | null }>;
  clientIds: ReadonlyArray<string>;
  /** Row counts for tables that are classified as a whole (keyed by SQL table name). */
  counts: Readonly<Record<string, number>>;
};

export type ClosurePlanRow = {
  table: string;
  action: ClassificationAction;
  legalConfirm: boolean;
  retain: number;
  anonymise: number;
  delete: number;
};

export type ClosurePlan = {
  /** Always false: a plan never executes anything. */
  executed: false;
  /** The whole plan rests on the 8-year default, which the lawyer must confirm. */
  legalConfirm: true;
  tables: ClosurePlanRow[];
  retainedClientIds: string[];
  retentionUntil: Date;
};

export function planAccountClosure(input: ClosurePlanInput): ClosurePlan {
  const retainedInvoices = input.invoices.filter((i) => i.status !== "draft");
  const draftCount = input.invoices.length - retainedInvoices.length;
  const retainedClientIds = [
    ...new Set(retainedInvoices.map((i) => i.clientId).filter((id): id is string => !!id)),
  ].filter((id) => input.clientIds.includes(id));

  const tables: ClosurePlanRow[] = Object.entries(ACCOUNT_DATA_CLASSIFICATION).map(([table, c]) => {
    const row: ClosurePlanRow = { table, action: c.action, legalConfirm: c.legalConfirm, retain: 0, anonymise: 0, delete: 0 };
    if (table === "user") {
      row.anonymise = 1;
    } else if (table === "invoice") {
      row.retain = retainedInvoices.length;
      row.delete = draftCount;
    } else if (table === "client") {
      row.retain = retainedClientIds.length;
      row.anonymise = retainedClientIds.length; // buyer e-mail cleared
      row.delete = input.clientIds.length - retainedClientIds.length;
    } else {
      const n = input.counts[table] ?? 0;
      if (c.action === "delete") row.delete = n;
      else if (c.action === "retain") row.retain = n;
    }
    return row;
  });

  return {
    executed: false,
    legalConfirm: true,
    tables,
    retainedClientIds,
    retentionUntil: accountRetentionUntil(
      retainedInvoices.map((i) => i.issueDate),
      input.closedAt,
    ),
  };
}
