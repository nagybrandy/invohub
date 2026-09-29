// components/invoices/composer/ComposerSummary.tsx
// Sticky right column on mid-width desktops (768–1023px, or when the live
// side preview is hidden): live Nettó/ÁFA/Bruttó totals + an "Előnézet"
// button that opens the real PDF in a drawer, never replacing the form
// (spec §2.2, INV-9, INV-13). ≥1024px the composer shows the live PDF
// itself in this column instead (InvoiceComposer).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ComposerPreviewButton } from "@/components/invoices/composer/ComposerPreviewButton";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceCurrency, InvoiceLineItem, InvoiceTotals } from "@/lib/invoices/types";

export function ComposerSummary({
  invoice,
  totals,
  currency,
  lineItems,
  t,
}: {
  invoice: Invoice;
  totals: InvoiceTotals;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const vatRows = groupVatRows(lineItems);

  return (
    <VStack space="md" className="sticky top-24 w-full md:w-[400px]" testID="composer-summary">
      <Card className="p-4 md:p-5">
        <VStack space="sm">
          <Heading size="sm" className="text-foreground">
            {t("invoices.composer.summaryTitle")}
          </Heading>
          <HStack className="justify-between">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.totals.netTotal")}
            </Text>
            <Text size="sm" className="tabular-nums text-foreground">
              {formatCurrency(totals.subtotal, currency)}
            </Text>
          </HStack>
          {vatRows.length > 0 ? (
            vatRows.map((row) => (
              <HStack key={row.key} className="justify-between">
                <Text size="sm" className="text-muted-foreground">
                  {t("invoices.composer.vatRowLabel", { label: row.label })}
                </Text>
                <Text size="sm" className="tabular-nums text-foreground">
                  {formatCurrency(row.vat, currency)}
                </Text>
              </HStack>
            ))
          ) : (
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.composer.vatRowEmpty")}
              </Text>
              <Text size="sm" className="tabular-nums text-foreground">
                {formatCurrency(0, currency)}
              </Text>
            </HStack>
          )}
          <Box className="border-t border-subtle pt-2">
            <HStack className="justify-between">
              <Text className="font-semibold text-foreground">
                {t("invoices.totals.grossTotal")}
              </Text>
              <Text
                size="lg"
                className="font-heading font-bold tabular-nums text-foreground"
                testID="composer-summary-gross"
              >
                {formatCurrency(totals.totalAmount, currency)}
              </Text>
            </HStack>
          </Box>
        </VStack>
      </Card>

      <ComposerPreviewButton invoice={invoice} t={t} />
    </VStack>
  );
}
