// components/invoices/InvoiceCard.tsx
// Summary card for a single invoice in the list view.
import { Trash2 } from "lucide-react-native";
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
import { STATUS_BADGE_VARIANT, STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { Invoice } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { confirmAsync } from "@/lib/ui/confirm";

function formatDate(invoice: Invoice): string {
  return formatInvoiceIssueDateTime(invoice);
}

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
  const icons = useIconColors();
  const totals = calculateInvoiceTotals(invoice.lineItems);

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

  return (
    <Pressable
      testID="invoice-card-press"
      onPress={() => onPress?.(invoice)}
      onLongPress={() => void confirmDelete()}
    >
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
            <HStack space="xs" className="items-center">
              <Badge variant={STATUS_BADGE_VARIANT[invoice.status]}>
                <BadgeText>{t(STATUS_I18N_KEY[invoice.status])}</BadgeText>
              </Badge>
              <Pressable
                onPress={() => void confirmDelete()}
                accessibilityRole="button"
                accessibilityLabel={t("invoices.card.deleteAction")}
                hitSlop={8}
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <Trash2 size={18} color={icons.destructive} />
              </Pressable>
            </HStack>
          </HStack>
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.card.issued", { date: formatDate(invoice) })}
            </Text>
            <Text className="font-semibold text-foreground">
              {formatCurrency(totals.totalAmount, invoice.currency)}
            </Text>
          </HStack>
          {onPreview ? (
            <Box>
              <Pressable onPress={() => onPreview(invoice)}>
                <Text size="xs" className="text-primary">
                  {t("invoices.card.quickPreview")}
                </Text>
              </Pressable>
            </Box>
          ) : null}
        </VStack>
      </Card>
    </Pressable>
  );
}
