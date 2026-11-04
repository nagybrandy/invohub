// components/invoices/composer/StepReview.tsx
// The read-only read-back of a FINALIZED invoice (the composer's read-only
// branch): partner, dates and payment, line items with their totals, notes.
// The editable page no longer has a review step — its sections are all open
// and editable on one page (redesign 2026-11); the send / NAV block is
// DispatchCard and the notes field lives in MoreSettingsCard.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ComposerCard } from "@/components/invoices/composer/ComposerSection";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { formatCurrency, lineItemGrossTotal } from "@/lib/invoices/calculations";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";

export function StepReview(composer: InvoiceComposerState) {
  const {
    t,
    clientName,
    clientTaxNumber,
    clientEmail,
    clientCountry,
    clientZip,
    clientCity,
    clientAddress,
    fulfillmentDate,
    issueDate,
    dueDate,
    paymentMethod,
    bankAccount,
    currency,
    exchangeRate,
    lineItems,
    notes,
    totals,
  } = composer;

  const vatRows = groupVatRows(lineItems);
  const address = [clientZip, clientCity, clientAddress].filter(Boolean).join(" ");

  return (
    <VStack space="lg" testID="composer-readonly-summary">
      <ComposerCard title={t("invoices.composer.reviewPartner")}>
        <Text className="text-sm font-semibold text-ink">{clientName || "—"}</Text>
        {clientTaxNumber ? <Text className="text-[13px] text-muted-ink">{clientTaxNumber}</Text> : null}
        {address ? <Text className="text-[13px] text-muted-ink">{address}</Text> : null}
        {clientCountry && clientCountry !== "Magyarország" ? (
          <Text className="text-[13px] text-muted-ink">{clientCountry}</Text>
        ) : null}
        {clientEmail ? <Text className="text-[13px] text-muted-ink">{clientEmail}</Text> : null}
      </ComposerCard>

      <ComposerCard title={t("invoices.sections.datesPayment")}>
        <Text className="text-sm text-ink">
          {t("invoices.fields.fulfillmentDate")}: {fulfillmentDate}
        </Text>
        <Text className="text-sm text-ink">
          {t("invoices.fields.issueDate")}: {issueDate} · {t("invoices.fields.paymentDeadline")}: {dueDate}
        </Text>
        <Text className="text-sm text-ink">
          {t(`invoices.paymentMethods.${paymentMethod}`)}
          {bankAccount ? ` · ${bankAccount}` : ""}
        </Text>
        <Text className="text-sm text-ink">
          {currency}
          {currency !== "HUF" && exchangeRate ? ` · ${exchangeRate}` : ""}
        </Text>
      </ComposerCard>

      <ComposerCard title={t("invoices.sections.lineItems")}>
        <VStack space="xs">
          {lineItems
            .filter((item) => item.description.trim())
            .map((item) => (
              <HStack key={item.id} className="justify-between gap-3">
                <Text className="flex-1 text-sm text-ink">
                  {item.description} × {item.quantity} {item.unit || "db"}
                </Text>
                <Text className="text-sm tabular-nums text-ink">
                  {formatCurrency(lineItemGrossTotal(item), currency)}
                </Text>
              </HStack>
            ))}
          <Box className="mt-2 items-end gap-1 border-t border-line pt-2">
            <Text className="text-sm text-muted-ink">
              {t("invoices.totals.netTotal")}: {formatCurrency(totals.subtotal, currency)}
            </Text>
            {vatRows.map((row) => (
              <Text key={row.key} className="text-sm text-muted-ink">
                {t("invoices.composer.vatRowLabel", { label: row.label })}: {formatCurrency(row.vat, currency)}
              </Text>
            ))}
            <Text className="text-sm font-semibold text-ink">
              {t("invoices.totals.grossTotal")}: {formatCurrency(totals.totalAmount, currency)}
            </Text>
          </Box>
        </VStack>
      </ComposerCard>

      <ComposerCard title={t("invoices.fields.notes")}>
        <Text className="text-sm text-ink">{notes || "—"}</Text>
      </ComposerCard>
    </VStack>
  );
}
