// lib/recurring/form.ts
// Pure helpers behind the recurring-invoice form and list (client-safe: no
// DB import). Validation reuses the server's schedule maths.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import {
  isValidDateKey,
  occurrenceDate,
  validateSchedule,
  type RecurrenceFrequency,
  type RecurrenceSchedule,
} from "@/lib/recurring/schedule";

export type RecurringFormValues = {
  name: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string;
  /** Free text from the input; empty = unlimited. */
  maxOccurrences: string;
  paymentTermDays: string;
};

/** Proposed schedule for a new template: the same day next month. */
export function defaultFormValues(todayBudapest: string): RecurringFormValues {
  const next = occurrenceDate({ frequency: "monthly", startDate: todayBudapest }, 1) ?? todayBudapest;
  return { name: "", frequency: "monthly", startDate: next, endDate: "", maxOccurrences: "", paymentTermDays: "8" };
}

export type ParsedForm =
  | { ok: true; name: string; schedule: RecurrenceSchedule; paymentTermDays: number }
  | { ok: false; error: "invalidSchedule" };

export function parseFormValues(values: RecurringFormValues): ParsedForm {
  const fail: ParsedForm = { ok: false, error: "invalidSchedule" };

  const endDate = values.endDate.trim();
  if (endDate && !isValidDateKey(endDate)) return fail;

  const rawCount = values.maxOccurrences.trim();
  let maxOccurrences: number | null = null;
  if (rawCount) {
    if (!/^\d+$/.test(rawCount)) return fail;
    maxOccurrences = Number(rawCount);
  }

  const term = Number(values.paymentTermDays.trim() === "" ? "8" : values.paymentTermDays);
  if (!Number.isInteger(term) || term < 0 || term > 365) return fail;

  const schedule: RecurrenceSchedule = {
    frequency: values.frequency,
    startDate: values.startDate.trim(),
    endDate: endDate || null,
    maxOccurrences,
  };
  if (!validateSchedule(schedule).ok) return fail;
  return { ok: true, name: values.name.trim(), schedule, paymentTermDays: term };
}

type TemplateLike = {
  name?: string;
  clientName: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  paymentTermDays: number;
  currency: string;
  lineItems: InvoiceLineItem[];
};

export function formValuesFromTemplate(t: TemplateLike): RecurringFormValues {
  return {
    name: t.name ?? "",
    frequency: t.frequency,
    startDate: t.startDate,
    endDate: t.endDate ?? "",
    maxOccurrences: t.maxOccurrences != null ? String(t.maxOccurrences) : "",
    paymentTermDays: String(t.paymentTermDays),
  };
}

/** What the list row shows: label, partner and the gross amount per generated draft. */
export function templateSummary(t: TemplateLike): { title: string; partner: string; gross: number } {
  const totals = calculateInvoiceTotals(t.lineItems);
  return { title: t.name?.trim() || t.clientName, partner: t.clientName, gross: totals.totalAmount };
}
