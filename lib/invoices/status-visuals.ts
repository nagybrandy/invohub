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

// Redesign 2026-11 (tokens.md §6.4): one colour per status, from the design
// tokens. Only `paid` is ever green; overdue is the only red; "waiting"
// (sent / unpaid) is the blue wash; draft, proforma and cancelled are neutral.
const NEUTRAL: StatusVisual = {
  chip: "bg-neutral-wash",
  text: "text-muted-ink",
  border: "border-transparent",
};
const WAITING: StatusVisual = {
  chip: "bg-primary-wash",
  text: "text-primary-ink",
  border: "border-transparent",
};

export const STATUS_VISUALS: Record<InvoiceStatus, StatusVisual> = {
  paid: { chip: "bg-ok-wash", text: "text-ok", border: "border-transparent" },
  partially_paid: { chip: "bg-warn-wash", text: "text-warn", border: "border-transparent" },
  sent: WAITING,
  unpaid: WAITING,
  overdue: { chip: "bg-err-wash", text: "text-err", border: "border-transparent" },
  draft: NEUTRAL,
  proforma: NEUTRAL,
  cancelled: NEUTRAL,
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
