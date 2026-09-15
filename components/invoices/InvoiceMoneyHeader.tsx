// components/invoices/InvoiceMoneyHeader.tsx
// The invoice detail header that "says the money" (D2): gross in large
// type, outstanding balance, and "Lejárt {{days}} napja" derived from the
// due date even when the stored status is still `sent` (D3).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import type { Invoice } from "@/lib/invoices/types";

export function InvoiceMoneyHeader({
  invoice,
  now = new Date(),
  primaryAction,
  secondaryAction,
}: {
  invoice: Invoice;
  now?: Date;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const paidAmount = invoice.paidAmount ?? 0;
  const outstanding = Math.max(0, totals.totalAmount - paidAmount);
  const overdue = isOverdue(invoice, now);
  const days = overdueDays(invoice, now);
  const displayStatus = overdue ? "overdue" : invoice.status;
  const showOutstanding = outstanding > 0 && invoice.status !== "draft" && invoice.status !== "cancelled";

  return (
    <VStack space="md" className="rounded-xl border border-subtle p-5" testID="invoice-money-header">
      <HStack className="flex-wrap items-start justify-between gap-4">
        <VStack space="xs">
          <HStack space="sm" className="flex-wrap items-center">
            <Text size="sm" className="font-medium text-muted-foreground">
              {invoice.invoiceNumber || t("invoices.status.draft")}
            </Text>
            <InvoiceStatusChip status={displayStatus} />
          </HStack>
          <Text size="sm" className="text-muted-foreground">
            {invoice.clientName}
          </Text>
          <Text
            className="font-heading text-2xl font-bold tabular-nums text-foreground"
            testID="invoice-money-header-gross"
          >
            {formatCurrency(totals.totalAmount, invoice.currency)}
          </Text>
          {showOutstanding ? (
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.detail.outstanding", {
                amount: formatCurrency(outstanding, invoice.currency),
              })}
            </Text>
          ) : null}
          {overdue ? (
            <Text
              size="sm"
              className="font-medium text-destructive"
              testID="invoice-money-header-overdue"
            >
              {t("invoices.list.overdueBy", { days })}
            </Text>
          ) : null}
        </VStack>
        <VStack space="xs" className="items-end">
          {primaryAction ?? null}
          {secondaryAction ?? null}
        </VStack>
      </HStack>
    </VStack>
  );
}
