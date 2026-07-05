// components/invoices/InvoiceCard.tsx
// Summary card for a single invoice in the list view.
import { Alert } from "react-native";
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
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  proforma: "Proforma",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Storno",
};

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
  const totals = calculateInvoiceTotals(invoice.lineItems);

  function confirmDelete() {
    Alert.alert(
      "Delete invoice",
      `Remove ${invoice.invoiceNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
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
              <BadgeText>{STATUS_LABEL[invoice.status]}</BadgeText>
            </Badge>
          </HStack>
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              Issued {formatDate(invoice)}
            </Text>
            <Text className="font-semibold text-foreground">
              {formatCurrency(totals.totalAmount, invoice.currency)}
            </Text>
          </HStack>
          {onPreview ? (
            <Box>
              <Pressable onPress={() => onPreview(invoice)}>
                <Text size="xs" className="text-primary">
                  Quick preview · long-press to delete
                </Text>
              </Pressable>
            </Box>
          ) : null}
        </VStack>
      </Card>
    </Pressable>
  );
}
