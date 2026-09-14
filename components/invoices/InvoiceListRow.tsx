// components/invoices/InvoiceListRow.tsx
// One row of the desktop invoice table (L1 — the dashboard already rendered
// a real table; the list gets the same visual language). Sorszám | Partner |
// Kelt | Fizetési határidő (+ overdue subtext) | Státusz | NAV | Bruttó |
// ⋯. Used by both /invoices and the dashboard's "recent invoices" table.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { formatCurrency, calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";
import { isOverdue, overdueDays } from "@/lib/invoices/status-visuals";

export const INVOICE_LIST_ROW_COLUMN_WIDTHS = {
  serial: 132,
  issued: 104,
  due: 120,
  status: 128,
  nav: 56,
  gross: 148,
  actions: 44,
} as const;

export function InvoiceListRow({
  invoice,
  now = new Date(),
  onPress,
  menuItems,
}: {
  invoice: Invoice;
  now?: Date;
  onPress?: (invoice: Invoice) => void;
  menuItems: OverflowMenuItem[];
}) {
  const { t } = useTranslation();
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const overdue = isOverdue(invoice, now);
  const days = overdueDays(invoice, now);
  const finalized = hasInvoiceNumber(invoice) && invoice.status !== "cancelled";
  const w = INVOICE_LIST_ROW_COLUMN_WIDTHS;

  return (
    <Pressable
      testID="invoice-list-row"
      onPress={onPress ? () => onPress(invoice) : undefined}
      className="flex-row items-center border-b border-subtle px-4 py-3 last:border-b-0 data-[hover=true]:bg-muted/40"
    >
      <Box style={{ width: w.serial }}>
        {hasInvoiceNumber(invoice) ? (
          <Text size="sm" className="font-medium text-foreground">
            {invoice.invoiceNumber}
          </Text>
        ) : (
          <VStack space="xs">
            <Text size="sm" className="text-muted-foreground">
              —
            </Text>
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.status.draft")}
            </Text>
          </VStack>
        )}
      </Box>
      <Box className="min-w-0 flex-1 pr-2">
        <Text size="sm" className="truncate text-foreground" numberOfLines={1}>
          {invoice.clientName}
        </Text>
      </Box>
      <Box style={{ width: w.issued }}>
        <Text size="sm" className="text-muted-foreground">
          {formatDateOnly(invoice.issueDate)}
        </Text>
      </Box>
      <Box style={{ width: w.due }}>
        <VStack space="xs">
          <Text size="sm" className={overdue ? "text-destructive" : "text-foreground"}>
            {formatDateOnly(invoice.dueDate)}
          </Text>
          {overdue ? (
            <Text size="xs" className="text-destructive" testID="invoice-row-overdue-label">
              {t("invoices.list.overdueBy", { days })}
            </Text>
          ) : null}
        </VStack>
      </Box>
      <Box style={{ width: w.status }}>
        <InvoiceStatusChip status={overdue ? "overdue" : invoice.status} size="sm" />
      </Box>
      <Box style={{ width: w.nav }} className="items-center">
        <Box
          testID="invoice-row-nav-dot"
          accessibilityLabel={
            finalized ? t("invoices.list.navSubmittedHint") : t("invoices.list.navNotSubmittedHint")
          }
          className={`h-2.5 w-2.5 rounded-full ${finalized ? "bg-primary" : "bg-muted-foreground/30"}`}
        />
      </Box>
      <Box style={{ width: w.gross }}>
        <Text numeric className="text-sm font-semibold text-foreground">
          {formatCurrency(totals.totalAmount, invoice.currency)}
        </Text>
      </Box>
      <HStack style={{ width: w.actions }} className="justify-end">
        <OverflowMenu items={menuItems} label={t("invoices.list.rowMenuLabel")} />
      </HStack>
    </Pressable>
  );
}
