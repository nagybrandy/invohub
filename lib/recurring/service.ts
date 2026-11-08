// lib/recurring/service.ts
// Recurring invoice templates (ismétlődő számlázás, v1).
//
// WHAT THIS DOES: saves an invoice as a template with a schedule, and — from
// the daily cron — turns every due template into a DRAFT invoice plus an
// in-app notification. The user reviews and issues the draft on the normal
// path, so numbering, the MNB rate on the issue date, the teljesítés date
// and NAV submission all stay exactly where they were.
//
// WHAT THIS DELIBERATELY DOES NOT DO (needs explicit OWNER SIGN-OFF first):
//  - automatic issuing (draft -> issued -> NAV without a human click), and
//  - any default teljesítés (fulfillment) date rule per recurring period
//    (see the MNB fulfillment-date decision of 2026-09-22).
// The generated draft therefore carries the same fresh-draft dates a new
// composer invoice gets (issue date = today, due date = today + payment
// term) and NO fulfillment date and NO exchange rate — the reviewer sets
// them when issuing. Nothing here may call finalizeInvoice / NAV / e-mail.
//
// Catch-up policy: at most ONE draft per template per run — the oldest
// outstanding period. If the cron missed days, the following daily runs
// catch up one period at a time (never a burst of drafts).
//
// Idempotency: each period is claimed by inserting a recurring_invoice_run
// row guarded by UNIQUE (template_id, period_key) with ON CONFLICT DO
// NOTHING; only the run that wins the claim creates the draft. If creating
// the draft fails, the claim is released so the next run retries. Known
// limitation: the neon-http driver has no interactive transaction, so a
// process killed between claim and draft creation leaves a claimed period
// without a draft; the next run then skips (and advances past) it rather
// than risk a duplicate. The failure window is a few milliseconds.
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { recurringInvoiceRun, recurringInvoiceTemplate } from "@/db/schema";
import { isDocumentLanguage } from "@/lib/companies/billing-settings";
import { addBudapestDays, budapestDateKey } from "@/lib/dates/budapest";
import { createId } from "@/lib/id";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import type { Invoice, InvoiceLineItem, PaymentMethod } from "@/lib/invoices/types";
import { createNotification } from "@/lib/notifications/service";
import { encodeNotificationText } from "@/lib/notifications/i18n";
import {
  firstIndexOnOrAfter,
  occurrenceDate,
  resolveDue,
  validateSchedule,
  type RecurrenceFrequency,
  type RecurrenceSchedule,
} from "@/lib/recurring/schedule";

export type RecurringStatus = "active" | "paused" | "completed";

export type RecurringTemplate = {
  id: string;
  userId: string;
  name?: string;
  sourceInvoiceId?: string;
  clientId?: string;
  clientName: string;
  clientTaxNumber?: string;
  clientZipCode?: string;
  clientCity?: string;
  clientAddress?: string;
  clientCountry?: string;
  clientEuVatNumber?: string;
  currency: string;
  language?: string;
  paymentMethod?: string;
  paymentTermDays: number;
  notes?: string;
  lineItems: InvoiceLineItem[];
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  nextIndex: number;
  nextRunDate?: string;
  status: RecurringStatus;
  lastGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RecurringErrorCode =
  | "invalidSchedule"
  | "scheduleEnded"
  | "unsupportedDocumentType"
  | "invalidInput";

export class RecurringTemplateError extends Error {
  constructor(
    public readonly code: RecurringErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RecurringTemplateError";
  }
}

type Row = typeof recurringInvoiceTemplate.$inferSelect;

function mapRow(row: Row): RecurringTemplate {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name ?? undefined,
    sourceInvoiceId: row.sourceInvoiceId ?? undefined,
    clientId: row.clientId ?? undefined,
    clientName: row.clientName,
    clientTaxNumber: row.clientTaxNumber ?? undefined,
    clientZipCode: row.clientZipCode ?? undefined,
    clientCity: row.clientCity ?? undefined,
    clientAddress: row.clientAddress ?? undefined,
    clientCountry: row.clientCountry ?? undefined,
    clientEuVatNumber: row.clientEuVatNumber ?? undefined,
    currency: row.currency,
    language: row.language ?? undefined,
    paymentMethod: row.paymentMethod ?? undefined,
    paymentTermDays: row.paymentTermDays,
    notes: row.notes ?? undefined,
    lineItems: (row.lineItems as InvoiceLineItem[]) ?? [],
    frequency: row.frequency as RecurrenceFrequency,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    maxOccurrences: row.maxOccurrences ?? undefined,
    nextIndex: row.nextIndex,
    nextRunDate: row.nextRunDate ?? undefined,
    status: row.status as RecurringStatus,
    lastGeneratedAt: row.lastGeneratedAt ? new Date(row.lastGeneratedAt).toISOString() : undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function scheduleOf(t: Pick<RecurringTemplate, "frequency" | "startDate" | "endDate" | "maxOccurrences">): RecurrenceSchedule {
  return {
    frequency: t.frequency,
    startDate: t.startDate,
    endDate: t.endDate ?? null,
    maxOccurrences: t.maxOccurrences ?? null,
  };
}

type Pointer = { nextIndex: number; nextRunDate: string | null; status: "active" | "completed" };

/** Position the series at its first occurrence on/after `today`. */
function pointerFrom(schedule: RecurrenceSchedule, today: string): Pointer {
  const index = firstIndexOnOrAfter(schedule, today);
  const date = occurrenceDate(schedule, index);
  return date === null
    ? { nextIndex: index, nextRunDate: null, status: "completed" }
    : { nextIndex: index, nextRunDate: date, status: "active" };
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

type Clock = { now?: Date };

/** Saves `source` (issued or draft) as a recurring template. Scoped to `userId`. */
export async function createTemplateFromInvoice(
  userId: string,
  source: Invoice,
  schedule: RecurrenceSchedule,
  options: Clock & { name?: string } = {}
): Promise<RecurringTemplate> {
  if (source.documentType !== "invoice") {
    throw new RecurringTemplateError(
      "unsupportedDocumentType",
      "Only a regular invoice can be saved as a recurring template."
    );
  }
  const valid = validateSchedule(schedule);
  if (!valid.ok) throw new RecurringTemplateError("invalidSchedule", valid.error);

  const now = options.now ?? new Date();
  const today = budapestDateKey(now);
  const pointer = pointerFrom(schedule, today);
  if (pointer.status === "completed") {
    throw new RecurringTemplateError("scheduleEnded", "The schedule has already ended.");
  }

  const termDays = Math.max(0, dayDiff(source.issueDate, source.dueDate));
  const [row] = await db
    .insert(recurringInvoiceTemplate)
    .values({
      id: createId(),
      userId,
      name: options.name?.trim() || null,
      sourceInvoiceId: source.id,
      clientId: source.clientId ?? null,
      clientName: source.clientName,
      clientTaxNumber: source.clientTaxNumber ?? null,
      clientZipCode: source.clientZipCode ?? null,
      clientCity: source.clientCity ?? null,
      clientAddress: source.clientAddress ?? null,
      clientCountry: source.clientCountry ?? null,
      clientEuVatNumber: source.clientEuVatNumber ?? null,
      currency: source.currency,
      language: source.language ?? null,
      paymentMethod: source.paymentMethod ?? null,
      paymentTermDays: Number.isFinite(termDays) ? termDays : 8,
      notes: source.notes ?? null,
      lineItems: source.lineItems,
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      endDate: schedule.endDate ?? null,
      maxOccurrences: schedule.maxOccurrences ?? null,
      nextIndex: pointer.nextIndex,
      nextRunDate: pointer.nextRunDate,
      status: pointer.status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

/** Convenience for the API: load the (account-scoped) invoice, then save it as a template. */
export async function createTemplateFromInvoiceId(
  userId: string,
  invoiceId: string,
  schedule: RecurrenceSchedule,
  options: Clock & { name?: string } = {}
): Promise<RecurringTemplate | null> {
  const source = await getInvoiceById(userId, invoiceId);
  if (!source) return null;
  return createTemplateFromInvoice(userId, source, schedule, options);
}

export async function listTemplates(userId: string): Promise<RecurringTemplate[]> {
  const rows = await db
    .select()
    .from(recurringInvoiceTemplate)
    .where(eq(recurringInvoiceTemplate.userId, userId))
    .orderBy(asc(recurringInvoiceTemplate.nextRunDate));
  return rows.map(mapRow);
}

export async function getTemplate(userId: string, id: string): Promise<RecurringTemplate | null> {
  const [row] = await db
    .select()
    .from(recurringInvoiceTemplate)
    .where(and(eq(recurringInvoiceTemplate.id, id), eq(recurringInvoiceTemplate.userId, userId)));
  return row ? mapRow(row) : null;
}

export type TemplatePatch = {
  name?: string | null;
  notes?: string | null;
  paymentTermDays?: number;
  schedule?: RecurrenceSchedule;
  /** "paused" pauses; "active" resumes. "completed" is system-managed. */
  status?: "active" | "paused";
};

/** Returns null when the template does not exist in this account. */
export async function updateTemplate(
  userId: string,
  id: string,
  patch: TemplatePatch,
  options: Clock = {}
): Promise<RecurringTemplate | null> {
  const current = await getTemplate(userId, id);
  if (!current) return null;

  const now = options.now ?? new Date();
  const today = budapestDateKey(now);
  const set: Partial<typeof recurringInvoiceTemplate.$inferInsert> = { updatedAt: now };

  if (patch.name !== undefined) set.name = patch.name?.trim() || null;
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
  if (patch.paymentTermDays !== undefined) {
    if (!Number.isInteger(patch.paymentTermDays) || patch.paymentTermDays < 0 || patch.paymentTermDays > 365) {
      throw new RecurringTemplateError("invalidInput", "paymentTermDays must be an integer between 0 and 365.");
    }
    set.paymentTermDays = patch.paymentTermDays;
  }

  let schedule = scheduleOf(current);
  let reposition = false;
  if (patch.schedule) {
    const valid = validateSchedule(patch.schedule);
    if (!valid.ok) throw new RecurringTemplateError("invalidSchedule", valid.error);
    schedule = patch.schedule;
    set.frequency = schedule.frequency;
    set.startDate = schedule.startDate;
    set.endDate = schedule.endDate ?? null;
    set.maxOccurrences = schedule.maxOccurrences ?? null;
    reposition = true;
  }

  let status: RecurringStatus = current.status;
  if (patch.status === "paused") status = "paused";
  if (patch.status === "active") {
    // Resuming (or re-activating a completed series after a schedule edit)
    // never back-fills the periods that passed while paused.
    if (current.status !== "active") reposition = true;
    status = "active";
  }

  if (reposition) {
    const pointer = pointerFrom(schedule, today);
    set.nextIndex = pointer.nextIndex;
    set.nextRunDate = pointer.nextRunDate;
    if (pointer.status === "completed") status = "completed";
    else if (status === "completed") status = "active";
  }
  set.status = status;

  const [row] = await db
    .update(recurringInvoiceTemplate)
    .set(set)
    .where(and(eq(recurringInvoiceTemplate.id, id), eq(recurringInvoiceTemplate.userId, userId)))
    .returning();
  return row ? mapRow(row) : null;
}

/** Deletes a template (generated drafts stay). False if it is not in this account. */
export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(recurringInvoiceTemplate)
    .where(and(eq(recurringInvoiceTemplate.id, id), eq(recurringInvoiceTemplate.userId, userId)))
    .returning({ id: recurringInvoiceTemplate.id });
  return rows.length > 0;
}

export type GenerateDueResult = {
  processed: number;
  created: number;
  /** Period was already claimed by another/earlier run — pointer healed, no draft. */
  skipped: number;
  failed: number;
  errors: string[];
};

function buildDraft(t: RecurringTemplate, today: string, now: Date): Invoice {
  const stamp = now.toISOString();
  return {
    id: createId(),
    invoiceNumber: "",
    documentType: "invoice",
    clientName: t.clientName,
    clientId: t.clientId,
    clientTaxNumber: t.clientTaxNumber,
    clientZipCode: t.clientZipCode,
    clientCity: t.clientCity,
    clientAddress: t.clientAddress,
    clientCountry: t.clientCountry,
    clientEuVatNumber: t.clientEuVatNumber,
    issueDate: today,
    dueDate: addBudapestDays(today, t.paymentTermDays),
    // Deliberately unset: a per-period teljesítés rule needs owner sign-off.
    fulfillmentDate: undefined,
    status: "draft",
    currency: t.currency,
    // Set by the reviewer / MNB autofill when the draft is issued.
    exchangeRate: undefined,
    lineItems: t.lineItems.map((item) => ({ ...item, id: createId() })),
    notes: t.notes,
    paymentMethod: t.paymentMethod as PaymentMethod | undefined,
    language: isDocumentLanguage(t.language) ? t.language : undefined,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

async function advance(t: RecurringTemplate, index: number, now: Date, generated: boolean) {
  const nextIndex = index + 1;
  const date = occurrenceDate(scheduleOf(t), nextIndex);
  await db
    .update(recurringInvoiceTemplate)
    .set({
      nextIndex,
      nextRunDate: date,
      status: date === null ? "completed" : "active",
      updatedAt: now,
      ...(generated ? { lastGeneratedAt: now } : {}),
    })
    // Conditional on the pointer we read: a concurrent run that already
    // advanced it makes this a no-op.
    .where(
      and(
        eq(recurringInvoiceTemplate.id, t.id),
        eq(recurringInvoiceTemplate.userId, t.userId),
        eq(recurringInvoiceTemplate.nextIndex, index)
      )
    );
}

async function generateForTemplate(
  t: RecurringTemplate,
  today: string,
  now: Date
): Promise<"created" | "skipped" | "idle"> {
  const due = resolveDue(scheduleOf(t), t.nextIndex, today);
  if (due.state === "waiting") return "idle";
  if (due.state === "completed") {
    await db
      .update(recurringInvoiceTemplate)
      .set({ status: "completed", nextRunDate: null, updatedAt: now })
      .where(and(eq(recurringInvoiceTemplate.id, t.id), eq(recurringInvoiceTemplate.userId, t.userId)));
    return "idle";
  }

  const runId = createId();
  const claimed = await db
    .insert(recurringInvoiceRun)
    .values({ id: runId, templateId: t.id, userId: t.userId, periodKey: due.periodKey, createdAt: now })
    .onConflictDoNothing()
    .returning({ id: recurringInvoiceRun.id });
  if (claimed.length === 0) {
    await advance(t, due.index, now, false);
    return "skipped";
  }

  const draft = buildDraft(t, today, now);
  try {
    await upsertInvoice(t.userId, draft);
  } catch (error) {
    await db
      .delete(recurringInvoiceRun)
      .where(and(eq(recurringInvoiceRun.id, runId), eq(recurringInvoiceRun.userId, t.userId)));
    throw error;
  }
  await db
    .update(recurringInvoiceRun)
    .set({ invoiceId: draft.id })
    .where(and(eq(recurringInvoiceRun.id, runId), eq(recurringInvoiceRun.userId, t.userId)));
  await advance(t, due.index, now, true);

  try {
    await createNotification(t.userId, {
      type: "system",
      title: encodeNotificationText("notifications.content.recurringDraftTitle", {
        clientName: t.clientName,
      }),
      body: encodeNotificationText("notifications.content.recurringDraftBody"),
      href: `/invoices/${draft.id}`,
      referenceKey: `recurring:${t.id}:${due.periodKey}`,
    });
  } catch (error) {
    // The draft exists; a missed notification must not undo or fail it.
    console.warn(`[recurring] notification failed for template ${t.id}: ${error instanceof Error ? error.message : error}`);
  }
  return "created";
}

/**
 * Creates the DRAFT for every due, active template (at most one per template
 * per call — see the catch-up policy at the top). `userId` limits the run to
 * one billing account (manual trigger); omit it for the whole-instance cron.
 */
export async function generateDueDrafts(
  options: Clock & { userId?: string } = {}
): Promise<GenerateDueResult> {
  const now = options.now ?? new Date();
  const today = budapestDateKey(now);
  const result: GenerateDueResult = { processed: 0, created: 0, skipped: 0, failed: 0, errors: [] };

  const rows = await db
    .select()
    .from(recurringInvoiceTemplate)
    .where(
      and(
        eq(recurringInvoiceTemplate.status, "active"),
        lte(recurringInvoiceTemplate.nextRunDate, today),
        options.userId ? eq(recurringInvoiceTemplate.userId, options.userId) : undefined
      )
    );

  for (const row of rows) {
    result.processed += 1;
    try {
      const outcome = await generateForTemplate(mapRow(row), today, now);
      if (outcome === "created") result.created += 1;
      if (outcome === "skipped") result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      const message = error instanceof Error && error.message ? error.message : String(error);
      result.errors.push(`template ${row.id}: ${message}`);
      console.warn(`[recurring] template ${row.id} failed: ${message}`);
    }
  }
  return result;
}
