// components/invoices/InvoiceFilterChips.tsx
// Invoice-list status chips, redesign 2026-11: the filter-sheet chips
// (tokens.md §6.4: pill, count in muted after the label, pressed = primary-ink
// fill with white text). Also the home of the list's filter constants. Pure
// presentational — no hooks — so it can be unit-tested without mocking
// useInvoiceStatusCounts.
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ChoicePill, ChoicePillGroup, choicePillTextClass } from "@/components/ui/choice-pill";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { InvoiceStatus } from "@/lib/invoices/types";

export const INVOICE_FILTERS: Array<InvoiceStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "unpaid",
  "overdue",
  "paid",
];

export function isKnownInvoiceFilter(value: string | undefined): value is InvoiceStatus | "all" {
  return !!value && (INVOICE_FILTERS as string[]).includes(value);
}

type Props = {
  filter: InvoiceStatus | "all";
  onSelect: (filter: InvoiceStatus | "all") => void;
  counts: Partial<Record<InvoiceStatus, number>>;
  /** Failed latest NAV submissions — the chip only appears when there are some (or it is active). */
  navFailedCount?: number;
  navFailedSelected?: boolean;
  onSelectNavFailed?: () => void;
  allCount: number;
  otherCount: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
};

export function InvoiceFilterChips({
  filter,
  onSelect,
  counts,
  allCount,
  otherCount,
  navFailedCount = 0,
  navFailedSelected = false,
  onSelectNavFailed,
  t,
}: Props) {
  const filterLabel = (f: InvoiceStatus | "all") =>
    f === "all" ? t("invoices.list.filterAll") : t(STATUS_I18N_KEY[f]);
  const filterCount = (f: InvoiceStatus | "all") => (f === "all" ? allCount : counts[f] ?? 0);

  return (
    <ChoicePillGroup accessibilityLabel={t("invoices.list.columnStatus")}>
      {INVOICE_FILTERS.map((f) => {
        const selected = filter === f && !navFailedSelected;
        return (
          <ChoicePill
            key={f}
            testID={`invoice-filter-${f}`}
            variant="filter"
            selected={selected}
            onPress={() => onSelect(f)}
          >
            <Text className={choicePillTextClass("filter", selected)}>{filterLabel(f)}</Text>
            <Text numeric className={`ml-1 text-sm ${selected ? "font-semibold text-white" : "text-muted-ink"}`}>
              {filterCount(f)}
            </Text>
          </ChoicePill>
        );
      })}
      {navFailedCount > 0 || navFailedSelected ? (
        // Not a status: a NAV outcome. Selecting it clears the status filter
        // (the screen does that), so it can never combine into an empty list
        // by accident.
        <ChoicePill
          testID="invoice-filter-navFailed"
          variant="filter"
          selected={navFailedSelected}
          onPress={() => onSelectNavFailed?.()}
        >
          <Text className={navFailedSelected ? choicePillTextClass("filter", true) : "text-sm font-medium text-err"}>
            {t("invoices.list.filterNavFailed")}
          </Text>
          <Text numeric className={`ml-1 text-sm ${navFailedSelected ? "font-semibold text-white" : "text-err"}`}>
            {navFailedCount}
          </Text>
        </ChoicePill>
      ) : null}
      {otherCount > 0 ? (
        // Deliberately NOT a ChoicePill / Pressable — this is an informational
        // remainder ("other" = proforma / partially_paid / cancelled), not a
        // working filter. No onPress at all, and dashed/muted styling keeps
        // it visually distinct from the real chips (tap-targets-44px slice,
        // fixing the dead control this used to be).
        <Box
          testID="invoice-filter-other"
          accessibilityLabel={t("invoices.list.filterOtherHint")}
          className="min-h-11 flex-row items-center justify-center rounded-full border border-dashed border-line-strong bg-transparent px-3.5 py-2 opacity-80"
        >
          <Text className="text-sm text-muted-ink">{t("invoices.list.filterOther")}</Text>
          <Text numeric className="ml-1 text-sm text-faint">
            {otherCount}
          </Text>
        </Box>
      ) : null}
    </ChoicePillGroup>
  );
}
