// components/invoices/InvoiceCard.tsx
// A single invoice as a stand-alone card (the dashboard's phone layout), in
// the redesign's card-row look (tokens.md §6.7): partner + bold amount,
// "number · date", status pill + NAV icon + overdue label, row menu. The list
// itself renders the same row through components/lists/InvoiceList. A numbered
// document is cancelled with a sztornó, never removed, so the menu offers
// delete for drafts only (canDeleteFromList) — and never send / NAV actions.
import { Eye, FileEdit, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import { NavStateIcon } from "@/components/invoices/NavStateIcon";
import { invoiceNavStatus } from "@/components/lists/InvoiceList";
import { ListCardRow } from "@/components/lists/ListCardRow";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import { isOverdue } from "@/lib/invoices/status-visuals";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";
import { confirmAsync } from "@/lib/ui/confirm";
import { canDeleteFromList } from "@/lib/invoices/list-actions";
import { dueLabel } from "@/lib/lists/due-label";

export function InvoiceCard({
  invoice,
  now = new Date(),
  onDelete,
  onPress,
  onPreview,
  onConvert,
  converted = false,
  onOpenExisting,
}: {
  invoice: Invoice;
  now?: Date;
  onDelete: (id: string) => void;
  onPress?: (invoice: Invoice) => void;
  onPreview?: (invoice: Invoice) => void;
  /** "Számla készítése ebből" — offered in the row menu only for a díjbekérő. */
  onConvert?: (invoice: Invoice) => void;
  /** True when this díjbekérő already has a live conversion — shows the "Számlázva" badge and swaps the menu's convert entry for "open existing". */
  converted?: boolean;
  /** Navigates to the existing conversion instead of converting again. */
  onOpenExisting?: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const overdue = isOverdue(invoice, now);
  const label = dueLabel(invoice, now);
  const showConverted = invoice.documentType === "proforma" && converted;

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
  if (invoice.documentType === "proforma" && converted && onOpenExisting) {
    menuItems.push({
      label: t("invoices.convert.openExisting"),
      icon: FileEdit,
      onPress: () => onOpenExisting(invoice),
    });
  } else if (invoice.documentType === "proforma" && onConvert) {
    menuItems.push({
      label: t("invoices.convert.action"),
      icon: FileEdit,
      onPress: () => onConvert(invoice),
    });
  }
  if (canDeleteFromList(invoice)) {
    menuItems.push({
      label: t("invoices.card.deleteAction"),
      icon: Trash2,
      destructive: true,
      onPress: () => void confirmDelete(),
    });
  }

  const number = hasInvoiceNumber(invoice) ? invoice.invoiceNumber : t("invoices.status.draft");

  return (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      <ListCardRow
        testID="invoice-card-press"
        title={invoice.clientName}
        amount={formatCurrency(totals.totalAmount, invoice.currency)}
        meta={`${number} · ${formatDateOnly(invoice.issueDate)}`}
        onPress={() => onPress?.(invoice)}
        badges={
          <>
            <InvoiceStatusChip status={overdue ? "overdue" : invoice.status} size="sm" />
            <NavStateIcon status={invoiceNavStatus(invoice)} testID="invoice-card-nav-dot" />
            {showConverted ? (
              <Text className="text-xs text-muted-ink">{t("invoices.convert.convertedBadge")}</Text>
            ) : null}
            {label?.kind === "overdue" ? (
              <Text testID="invoice-card-overdue-label" className="text-[13px] text-err">
                {t("invoices.list.overdueBy", { days: label.days })}
              </Text>
            ) : null}
          </>
        }
        menu={<OverflowMenu items={menuItems} label={t("invoices.list.rowMenuLabel")} />}
      />
    </Box>
  );
}
