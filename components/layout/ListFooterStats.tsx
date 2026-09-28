// components/layout/ListFooterStats.tsx
// The totals row under a list (invoices, receipts): row count and per-currency
// sums of what is loaded. Says how much of the whole list that is when the
// list is paged, so nobody reads a page's sum as the year's.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";
import type { ListFooterSummary } from "@/lib/lists/footer-stats";

type Props = {
  summary: ListFooterSummary;
  /** Rows in the whole (server-side) list when paged; omitted = everything is loaded. */
  total?: number;
  /** Show net/VAT columns (invoices) or only gross (receipts). */
  showNet?: boolean;
  testID?: string;
};

export function ListFooterStats({ summary, total, showNet = true, testID = "list-footer-stats" }: Props) {
  const { t } = useTranslation();
  if (summary.count === 0) return null;
  const partial = typeof total === "number" && total > summary.count;
  return (
    <Box className="mt-3 rounded-lg border border-subtle bg-muted/40 px-4 py-3" testID={testID}>
      <HStack space="md" className="flex-wrap items-baseline justify-between gap-y-1">
        <Text size="sm" className="font-medium text-foreground">
          {partial
            ? t("common.listFooter.countOf", { shown: summary.count, total })
            : t("common.listFooter.count", { count: summary.count })}
        </Text>
        <HStack space="lg" className="flex-wrap gap-y-1">
          {summary.byCurrency.map((row) => (
            <Text key={row.currency} size="sm" className="tabular-nums text-muted-foreground">
              {showNet
                ? t("common.listFooter.netGross", {
                    net: formatCurrency(row.net, row.currency as Invoice["currency"]),
                    gross: formatCurrency(row.gross, row.currency as Invoice["currency"]),
                  })
                : t("common.listFooter.gross", {
                    gross: formatCurrency(row.gross, row.currency as Invoice["currency"]),
                  })}
            </Text>
          ))}
        </HStack>
      </HStack>
    </Box>
  );
}
