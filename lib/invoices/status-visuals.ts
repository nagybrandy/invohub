// lib/invoices/status-visuals.ts
// Single source of truth for InvoiceStatus -> chip/text/border colors, used
// by InvoiceStatusChip everywhere a status renders (list, dashboard, detail)
// so the app never shows two different visual systems for the same status
// again (L3, V5). Only `paid` is ever green.
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

export type StatusVisual = {
  /** Chip background className fragment (Tailwind, theme-token based). */
  chip: string;
  /** Chip/label text color className fragment. */
  text: string;
  /** Chip border color className fragment. */
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

const OVERDUE_ELIGIBLE_STATUSES: InvoiceStatus[] = [
  "sent",
  "unpaid",
  "overdue",
  "partially_paid",
];

/**
 * Whether an invoice should be *presented* as overdue — derived from the due
 * date, not just the stored `status`. A `sent` invoice past its due date is
 * shown as overdue even before any background job flips the stored status
 * (D3). This never writes the status back; it's a display-only derivation.
 */
export function isOverdue(
  invoice: Pick<Invoice, "status" | "dueDate">,
  now: Date = new Date()
): boolean {
  if (invoice.status === "overdue") return true;
  if (!OVERDUE_ELIGIBLE_STATUSES.includes(invoice.status)) return false;
  const due = new Date(`${invoice.dueDate.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

/** Whole days an invoice has been overdue (0 if not overdue or due today). */
export function overdueDays(
  invoice: Pick<Invoice, "status" | "dueDate">,
  now: Date = new Date()
): number {
  if (!isOverdue(invoice, now)) return 0;
  const due = new Date(`${invoice.dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
