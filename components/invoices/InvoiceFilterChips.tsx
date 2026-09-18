// components/invoices/InvoiceFilterChips.tsx
// Invoice-list status filter chips (extracted from app/(app)/invoices/index.tsx
// so the list screen renders a component, not an inline FILTERS.map). Pure
// presentational — no hooks — so it can be unit-tested without mocking
// useInvoiceStatusCounts.
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
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
  allCount: number;
  otherCount: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
};

export function InvoiceFilterChips({ filter, onSelect, counts, allCount, otherCount, t }: Props) {
  const filterLabel = (f: InvoiceStatus | "all") =>
    f === "all" ? t("invoices.list.filterAll") : t(STATUS_I18N_KEY[f]);
  const filterCount = (f: InvoiceStatus | "all") => (f === "all" ? allCount : counts[f] ?? 0);

  return (
    <ChoicePillGroup>
      {INVOICE_FILTERS.map((f) => {
        const selected = filter === f;
        return (
          <ChoicePill
            key={f}
            testID={`invoice-filter-${f}`}
            selected={selected}
            onPress={() => onSelect(f)}
            className="rounded-full"
          >
            <Text size="xs" className={selected ? "font-medium text-primary" : "text-foreground"}>
              {t("invoices.list.filterCount", { label: filterLabel(f), count: filterCount(f) })}
            </Text>
          </ChoicePill>
        );
      })}
      {otherCount > 0 ? (
        // Deliberately NOT a ChoicePill / Pressable — this is an informational
        // remainder ("other" = proforma / partially_paid / cancelled), not a
        // working filter. No onPress at all, and dashed/muted styling keeps
        // it visually distinct from the real chips (tap-targets-44px slice,
        // fixing the dead control this used to be).
        <Box
          testID="invoice-filter-other"
          accessibilityLabel={t("invoices.list.filterOtherHint")}
          className="items-center justify-center rounded-full border border-dashed border-border bg-transparent px-3 py-2 opacity-70"
        >
          <Text size="xs" className="text-muted-foreground">
            {t("invoices.list.filterCount", { label: t("invoices.list.filterOther"), count: otherCount })}
          </Text>
        </Box>
      ) : null}
    </ChoicePillGroup>
  );
}
