// lib/lists/filter-state.ts
// Pure helpers behind the invoice list's filter UI: how many filters are
// active (the badge on "Szűrés és rendezés"), and the period select's options.
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/invoices/list-query";
import { DEFAULT_INVOICE_SORT, type InvoiceListSort } from "@/lib/lists/invoice-sort";
import type { InvoiceStatus } from "@/lib/invoices/types";

export function activeFilterCount(state: {
  filter: InvoiceStatus | "all";
  navFailed: boolean;
  month?: string;
  sort: InvoiceListSort;
}): number {
  let count = 0;
  if (state.filter !== "all" || state.navFailed) count += 1;
  if (state.month) count += 1;
  if (state.sort.key !== DEFAULT_INVOICE_SORT.key || state.sort.direction !== DEFAULT_INVOICE_SORT.direction) {
    count += 1;
  }
  return count;
}

export type PeriodOption = { value: string; label: string };

/** "" = all time, then the current month and the previous `months - 1`, newest first. */
export function buildPeriodOptions(input: {
  allLabel: string;
  language: string;
  now?: Date;
  months?: number;
  /** A month outside the window (e.g. stepped there before) stays selectable. */
  selected?: string;
}): PeriodOption[] {
  const { allLabel, language, now = new Date(), months = 24, selected } = input;
  const start = currentMonth(now);
  const values: string[] = [];
  for (let i = 0; i < months; i += 1) values.push(shiftMonth(start, -i));
  if (selected && !values.includes(selected)) values.push(selected);
  return [
    { value: "", label: allLabel },
    ...values.map((value) => ({ value, label: formatMonthLabel(value, language) })),
  ];
}
