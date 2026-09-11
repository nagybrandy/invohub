// components/invoices/InvoiceCard.tsx
// Summary card for a single invoice in the list view.
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoices/calculations";
import { formatInvoiceIssueDateTime } from "@/lib/dates/format";
import { invoiceStatusI18nKey } from "@/lib/invoices/status-label";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  proforma: "outline",
  sent: "default",
  paid: "outline",
  overdue: "destructive",
  cancelled: "destructive",
};

export function InvoiceCard({
  invoice,
  onDelete,
  onPress,
  onPreview,
}: {
  invoice: Invoice;
  onDelete: (id: string) => void;
  onPress?: (invoice: Invoice) => void;
  onPreview?: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const statusLabel = t(invoiceStatusI18nKey(invoice.status));

  function confirmDelete() {
    Alert.alert(
      t("invoices.deleteTitle"),
      t("invoices.deleteConfirm", { number: invoice.invoiceNumber }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => onDelete(invoice.id),
        },
      ]
    );
  }

  return (
    <Pressable onPress={() => onPress?.(invoice)} onLongPress={confirmDelete}>
      <Card className="p-4">
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack space="xs" className="flex-1 pr-3">
              <Text className="font-semibold text-foreground">
                {invoice.invoiceNumber}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {invoice.clientName}
              </Text>
            </VStack>
            <Badge variant={STATUS_VARIANT[invoice.status]}>
              <BadgeText>{statusLabel}</BadgeText>
            </Badge>
          </HStack>
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.issuedOn", {
                date: formatInvoiceIssueDateTime(invoice),
              })}
            </Text>
            <Text className="font-semibold text-foreground">
              {formatCurrency(totals.totalAmount, invoice.currency)}
            </Text>
          </HStack>
          {onPreview ? (
            <Box>
              <Pressable onPress={() => onPreview(invoice)}>
                <Text size="xs" className="text-primary">
                  {t("invoices.quickPreviewHint")}
                </Text>
              </Pressable>
            </Box>
          ) : null}
        </VStack>
      </Card>
    </Pressable>
  );
}
