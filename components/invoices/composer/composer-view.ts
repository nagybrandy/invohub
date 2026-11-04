// components/invoices/composer/composer-view.ts
// Pure presentation helpers of the single-page composer (redesign 2026-11):
// nothing here touches the composer's state, validation or API payloads.
import type { Invoice } from "@/lib/invoices/types";

/** The page uses the side preview column from this window width (SPEC §3, wide). */
export const PREVIEW_SIDE_MIN_WIDTH = 1100;
/** Width of the side preview column in px (tokens.md §6.18). */
export const PREVIEW_COLUMN_WIDTH = 420;
/** Line items switch from the two-line card to one row at this container width. */
export const ITEM_ROW_MIN_WIDTH = 820;
/** Below this container width the line total drops to its own line. */
export const ITEM_TOTAL_OWN_LINE_MAX = 480;
/** The copy-from-invoice popover lists this many recent invoices. */
export const RECENT_INVOICE_COUNT = 5;
/** "Gyors hozzáadás" offers this many of the user's products. */
export const QUICK_PRODUCT_COUNT = 5;

export type PreviewPresentation = "side" | "sheet";

/** Side column from 1100px, a sheet below that. */
export function previewPresentation(windowWidth: number): PreviewPresentation {
  return windowWidth >= PREVIEW_SIDE_MIN_WIDTH ? "side" : "sheet";
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); null when either is not a date. */
export function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Last day of the month before `today` (YYYY-MM-DD in, YYYY-MM-DD out): the "Előző hó vége" chip. */
export function previousMonthEndIso(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)); // 1-12
  // Day 0 of this month is the last day of the previous one.
  const end = new Date(Date.UTC(year, month - 1, 0));
  return end.toISOString().slice(0, 10);
}

export type HighlightParts = { before: string; match: string; after: string };

/** Splits `text` around the first case-insensitive occurrence of `query` (for the bold match in the partner popover). */
export function highlightParts(text: string, query: string): HighlightParts {
  const q = query.trim();
  if (!q) return { before: text, match: "", after: "" };
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, index),
    match: text.slice(index, index + q.length),
    after: text.slice(index + q.length),
  };
}

/**
 * The invoices offered by "Másolás korábbi számlából": the most recent ones,
 * skipping storno documents (a copy of a reversal is never what anyone wants).
 * The API list is already newest-first; this keeps that order.
 */
export function recentInvoicesForCopy(invoices: Invoice[] | undefined, count = RECENT_INVOICE_COUNT): Invoice[] {
  return (invoices ?? []).filter((invoice) => invoice.documentType !== "storno").slice(0, count);
}

/** The select value of a line's VAT treatment: "normal:27" for a taxed rate, the category code otherwise. */
export function vatSelectValue(category: string, rate: number): string {
  return category === "normal" ? `normal:${rate}` : category;
}

/** Inverse of vatSelectValue. */
export function parseVatSelectValue(value: string): { category: string; rate: number | null } {
  if (value.startsWith("normal:")) return { category: "normal", rate: Number(value.slice(7)) };
  return { category: value, rate: null };
}
