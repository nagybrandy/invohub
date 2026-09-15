// components/invoices/InvoiceCard.tsx
// Mobile summary card for a single invoice in the list view. Carries the due
// date + overdue subtext and the shared status chip (L3, L9), and keeps the
// destructive delete out of the row — it lives at the bottom of the row's
// "⋯" menu instead (L4), alongside quick preview.
import { Eye, FileEdit, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import {
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoices/calculations";
import { formatInvoiceIssueDateTime, formatDateOnly } from "@/lib/dates/format";
import { isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import type { Invoice } from "@/lib/invoices/types";
import { confirmAsync } from "@/lib/ui/confirm";

function formatDate(invoice: Invoice): string {
  return formatInvoiceIssueDateTime(invoice);
}

export function InvoiceCard({
  invoice,
  now = new Date(),
  onDelete,
  onPress,
  onPreview,
  onConvert,
}: {
  invoice: Invoice;
  now?: Date;
  onDelete: (id: string) => void;
  onPress?: (invoice: Invoice) => void;
  onPreview?: (invoice: Invoice) => void;
  /** "Számla készítése ebből" — offered in the row menu only for a díjbekérő (AC21, mobile parity with the desktop table). */
  onConvert?: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const overdue = isOverdue(invoice, now);
  const days = overdueDays(invoice, now);

  async function confirmDelete() {
    const confirmed = await confirmAsync({
      title: t("invoices.card.deleteTitle"),
      message: t("invoices.card.deleteMessage", { number: invoice.invoiceNumber }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (confirmed) {
      onDelete(invoice.id);
    }
  }

  const menuItems: OverflowMenuItem[] = [];
  if (onPreview) {
    menuItems.push({
      label: t("invoices.card.quickPreview"),
      icon: Eye,
      onPress: () => onPreview(invoice),
    });
  }
  if (invoice.documentType === "proforma" && onConvert) {
    menuItems.push({
      label: t("invoices.convert.action"),
      icon: FileEdit,
      onPress: () => onConvert(invoice),
    });
  }
  menuItems.push({
    label: t("invoices.card.deleteAction"),
    icon: Trash2,
    destructive: true,
    onPress: () => void confirmDelete(),
  });

  return (
    <Pressable testID="invoice-card-press" onPress={() => onPress?.(invoice)}>
      <Card className="p-4">
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack space="xs" className="flex-1 pr-3">
              <Text className="font-semibold text-foreground">
                {invoice.invoiceNumber || t("invoices.status.draft")}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {invoice.clientName}
              </Text>
            </VStack>
            <HStack space="xs" className="items-center">
              <InvoiceStatusChip status={overdue ? "overdue" : invoice.status} size="sm" />
              <OverflowMenu items={menuItems} label={t("invoices.list.rowMenuLabel")} />
            </HStack>
          </HStack>
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.card.issued", { date: formatDate(invoice) })}
            </Text>
            <Text className="font-semibold text-foreground" numeric>
              {formatCurrency(totals.totalAmount, invoice.currency)}
            </Text>
          </HStack>
          <HStack className="items-center justify-between">
            <VStack space="xs">
              <Text size="xs" className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                {t("invoices.list.columnDue")}: {formatDateOnly(invoice.dueDate)}
              </Text>
              {overdue ? (
                <Text size="xs" className="font-medium text-destructive" testID="invoice-card-overdue-label">
                  {t("invoices.list.overdueBy", { days })}
                </Text>
              ) : null}
            </VStack>
          </HStack>
        </VStack>
      </Card>
    </Pressable>
  );
}
