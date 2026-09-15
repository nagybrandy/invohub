// components/invoices/composer/ComposerSummary.tsx
// Desktop sticky right column: live Nettó/ÁFA/Bruttó totals + a shrunk live
// document preview that never replaces the form (spec §2.2, INV-9, INV-13).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoicePdfCompany } from "@/lib/invoices/generate-pdf";
import type { Invoice, InvoiceCurrency, InvoiceLineItem, InvoiceTotals } from "@/lib/invoices/types";

export function ComposerSummary({
  invoice,
  invoiceId,
  company,
  totals,
  currency,
  lineItems,
  t,
}: {
  invoice: Invoice;
  /** Saved invoice id — only set once the invoice has actually been persisted (mode="edit"). */
  invoiceId?: string;
  /** The signed-in user's own company — for the unsaved-draft preview's issuer block. */
  company?: InvoicePdfCompany;
  totals: InvoiceTotals;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
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

      <Card className="overflow-hidden p-3">
        <VStack space="sm">
          <Button
            size="sm"
            variant="outline"
            onPress={() => setPreviewOpen(true)}
            testID="composer-open-preview"
          >
            <ButtonText>{t("invoices.composer.openFullPreview")}</ButtonText>
          </Button>
          <Box
            className="pointer-events-none h-[220px] origin-top-left scale-[0.42] overflow-hidden rounded-md border border-subtle"
            style={{ width: "238%" }}
          >
            <InvoiceDocumentPreview invoice={invoice} company={company} layout="tabs" minHeight={520} />
          </Box>
        </VStack>
      </Card>

      <Drawer isOpen={previewOpen} onClose={() => setPreviewOpen(false)} size="lg" anchor="bottom">
        <DrawerBackdrop />
        <DrawerContent className="max-h-[92%]">
          <DrawerHeader>
            <Heading size="md">{t("invoices.composer.fullPreviewTitle")}</Heading>
          </DrawerHeader>
          <DrawerBody className="flex-1">
            <InvoiceDocumentPreview
              invoice={invoice}
              invoiceId={invoiceId}
              company={company}
              minHeight={480}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}
