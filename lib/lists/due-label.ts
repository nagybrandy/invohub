// lib/lists/due-label.ts
// The line under the "Fizetési határidő" date: "N nap múlva" for an open
// invoice, "Lejárt N napja" once it is overdue (rendered in the error colour),
// nothing for paid / cancelled / draft documents.
import { isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

export type DueLabel = { kind: "overdue"; days: number } | { kind: "upcoming"; days: number } | null;

const OPEN_STATUSES: InvoiceStatus[] = ["sent", "unpaid", "partially_paid"];

export function dueLabel(invoice: Pick<Invoice, "status" | "dueDate">, now: Date = new Date()): DueLabel {
  if (isOverdue(invoice, now)) return { kind: "overdue", days: overdueDays(invoice, now) };
  if (!OPEN_STATUSES.includes(invoice.status)) return null;
  const due = new Date(`${invoice.dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return { kind: "upcoming", days: Math.max(0, days) };
}
