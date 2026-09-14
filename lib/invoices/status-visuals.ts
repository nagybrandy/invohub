// lib/invoices/status-visuals.ts
// Single source of truth for invoice status colors (L3, V5). Every screen
// that renders a status chip, badge, or overdue label must read from here —
// `paid` is the ONLY status that is ever green anywhere in the app.
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

export type StatusVisual = {
  /** Chip background className. */
  chip: string;
  /** Chip text className. */
  text: string;
  /** Chip border className. */
  border: string;
};

export const STATUS_VISUALS: Record<InvoiceStatus, StatusVisual> = {
  paid: {
    chip: "bg-[#15803d]/10",
    text: "text-[#15803d]",
    border: "border-[#15803d]/30",
  },
  partially_paid: {
    chip: "bg-amber-500/10",
    text: "text-amber-700",
    border: "border-amber-500/30",
  },
  sent: {
    chip: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
  },
  unpaid: {
    chip: "bg-muted",
    text: "text-foreground",
    border: "border-border",
  },
  overdue: {
    chip: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  draft: {
    chip: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  proforma: {
    chip: "bg-accent",
    text: "text-accent-foreground",
    border: "border-primary/20",
  },
  cancelled: {
    chip: "bg-muted/60",
    text: "text-muted-foreground/70",
    border: "border-border/50",
  },
};

const OVERDUE_ELIGIBLE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  "sent",
  "unpaid",
  "partially_paid",
]);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whether an invoice should be *displayed* as overdue right now. This is a
 * presentational derivation only — `dueDate < today` for a status that is
 * still awaiting payment — and never writes back to `invoice.status` (D3).
 */
export function isOverdue(invoice: Pick<Invoice, "status" | "dueDate">, now: Date = new Date()): boolean {
  if (!OVERDUE_ELIGIBLE_STATUSES.has(invoice.status)) return false;
  if (!invoice.dueDate) return false;
  const due = startOfDay(new Date(invoice.dueDate));
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < startOfDay(now).getTime();
}

/** Whole days since the due date, floored at 0. Use with isOverdue(). */
export function overdueDays(invoice: Pick<Invoice, "dueDate">, now: Date = new Date()): number {
  const due = startOfDay(new Date(invoice.dueDate));
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = startOfDay(now).getTime() - due.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
