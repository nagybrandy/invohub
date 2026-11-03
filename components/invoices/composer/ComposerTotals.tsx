// components/invoices/composer/ComposerTotals.tsx
// The totals block under the line items (tokens.md §6.18): right-aligned,
// max 340px, net and VAT rows, then the gross row at 22/700 above a
// --line-strong rule. Shared by the invoice composer and the receipt page.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency } from "@/lib/invoices/types";
import { type } from "@/lib/ui/type";

export type TotalsRow = { key: string; label: string; amount: number };

export function ComposerTotals({
  netLabel,
  net,
  vatRows,
  grossLabel,
  gross,
  currency,
  testID = "composer-totals",
}: {
  netLabel: string;
  net: number;
  vatRows: TotalsRow[];
  grossLabel: string;
  gross: number;
  currency: InvoiceCurrency;
  testID?: string;
}) {
  return (
    <Box className="mt-5 w-full max-w-[340px] self-end" testID={testID}>
      <HStack className="min-h-[26px] items-center justify-between gap-4">
        <Text className="text-sm text-muted-ink">{netLabel}</Text>
        <Text className={`${type.money} text-sm text-ink`}>{formatCurrency(net, currency)}</Text>
      </HStack>
      {vatRows.map((row) => (
        <HStack key={row.key} className="min-h-[26px] items-center justify-between gap-4">
          <Text className="text-sm text-muted-ink">{row.label}</Text>
          <Text className={`${type.money} text-sm text-ink`}>{formatCurrency(row.amount, currency)}</Text>
        </HStack>
      ))}
      <HStack className="mt-2 items-center justify-between gap-4 border-t border-line-strong pt-3">
        <Text className="text-sm font-semibold text-ink">{grossLabel}</Text>
        <Text className={`${type.money} font-heading text-[22px] font-bold text-ink`} testID={`${testID}-gross`}>
          {formatCurrency(gross, currency)}
        </Text>
      </HStack>
    </Box>
  );
}
