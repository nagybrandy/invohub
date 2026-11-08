// components/lists/InvoiceList.tsx
// The invoice list card shared by Számlák and Főoldal's "Legutóbbi számlák":
// a table (container > 820px) with the columns Sorszám, Partner, Kelt,
// Fizetési határidő, Státusz, NAV, Bruttó összeg and a row menu, or one card
// per invoice below that (tokens.md §6.6 / §6.7). Only the amount is bold.
// Sorting, the Státusz header popover and the footer are optional so the
// dashboard can use it read-only.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import { NavStateIcon } from "@/components/invoices/NavStateIcon";
import { ListCardRow } from "@/components/lists/ListCardRow";
import { ListTable, type ListColumn } from "@/components/lists/ListTable";
import { StatusHeaderPopover, type StatusOption } from "@/components/lists/StatusHeaderPopover";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";
import { isOverdue } from "@/lib/invoices/status-visuals";
import { dueLabel } from "@/lib/lists/due-label";
import type { InvoiceListSort, InvoiceSortKey } from "@/lib/lists/invoice-sort";
import type { InvoiceStatus } from "@/lib/invoices/types";

export const INVOICE_LIST_COLUMN_WIDTHS = {
  serial: 156,
  issued: 112,
  due: 132,
  status: 124,
  nav: 56,
  gross: 148,
} as const;

export type InvoiceStatusFilterProps = {
  value: InvoiceStatus | "all";
  options: StatusOption<InvoiceStatus | "all">[];
  onChange: (value: InvoiceStatus | "all") => void;
};

export type InvoiceListProps = {
  invoices: Invoice[];
  loading?: boolean;
  now?: Date;
  sort?: InvoiceListSort;
  onSortChange?: (key: InvoiceSortKey) => void;
  onRowPress?: (invoice: Invoice) => void;
  menuItemsFor: (invoice: Invoice) => OverflowMenuItem[];
  empty?: React.ReactNode;
  /** proformaId -> its live conversion's invoice id: shows the "Számlázva" sub-label. */
  convertedIds?: Record<string, string>;
  /** Turns the Státusz header into the single-choice filter popover. */
  statusFilter?: InvoiceStatusFilterProps;
  footer?: React.ReactNode;
  attachedToTabs?: boolean;
  layout?: "table" | "cards";
};

/** "Piszkozat" (faint) for an unnumbered draft, the number otherwise. */
export function InvoiceNumberCell({ invoice, converted }: { invoice: Invoice; converted: boolean }) {
  const { t } = useTranslation();
  const numbered = hasInvoiceNumber(invoice);
  const typeLabel = t(`invoices.documentTypes.${invoice.documentType}`);
  return (
    <Box className="min-w-0">
      {numbered ? (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {invoice.invoiceNumber}
        </Text>
      ) : (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-faint">
          {t("invoices.status.draft")}
        </Text>
      )}
      <Text numberOfLines={1} className="whitespace-nowrap text-xs text-muted-ink">
        {converted && invoice.documentType === "proforma" ? `${typeLabel} · ${t("invoices.convert.convertedBadge")}` : typeLabel}
      </Text>
    </Box>
  );
}

export function InvoiceDueCell({ invoice, now }: { invoice: Invoice; now: Date }) {
  const { t } = useTranslation();
  const label = dueLabel(invoice, now);
  const overdue = label?.kind === "overdue";
  if (invoice.status === "draft") {
    return <Text className="text-sm text-faint">–</Text>;
  }
  return (
    <Box>
      <Text className={`text-sm ${overdue ? "text-err" : "text-ink"}`}>{formatDateOnly(invoice.dueDate)}</Text>
      {label ? (
        <Text
          testID={overdue ? "invoice-row-overdue-label" : "invoice-row-due-in-label"}
          className={`text-xs ${overdue ? "text-err" : "text-muted-ink"}`}
        >
          {overdue
            ? t("invoices.list.overdueBy", { days: label.days })
            : label.days === 0
              ? t("lists.dueToday")
              : t("lists.dueIn", { days: label.days })}
        </Text>
      ) : null}
    </Box>
  );
}

export function invoiceNavStatus(invoice: Invoice) {
  const finalized = hasInvoiceNumber(invoice) && invoice.status !== "cancelled";
  return invoice.navStatus ?? (finalized ? "notSubmitted" : "none");
}

export function InvoiceList({
  invoices,
  loading = false,
  now = new Date(),
  sort,
  onSortChange,
  onRowPress,
  menuItemsFor,
  empty,
  convertedIds,
  statusFilter,
  footer,
  attachedToTabs,
  layout,
}: InvoiceListProps) {
  const { t } = useTranslation();
  const w = INVOICE_LIST_COLUMN_WIDTHS;

  const columns: ListColumn<Invoice>[] = [
    {
      key: "serial",
      header: t("invoices.list.columnNumber"),
      width: w.serial,
      render: (invoice) => <InvoiceNumberCell invoice={invoice} converted={!!convertedIds?.[invoice.id]} />,
    },
    {
      key: "partner",
      header: t("invoices.list.columnPartner"),
      render: (invoice) => (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {invoice.clientName}
        </Text>
      ),
    },
    {
      key: "issued",
      header: t("invoices.list.columnIssued"),
      width: w.issued,
      sortable: true,
      render: (invoice) => <Text className="text-sm text-ink">{formatDateOnly(invoice.issueDate)}</Text>,
    },
    {
      key: "due",
      header: t("invoices.list.columnDue"),
      width: w.due,
      sortable: true,
      render: (invoice) => <InvoiceDueCell invoice={invoice} now={now} />,
    },
    {
      key: "status",
      header: t("invoices.list.columnStatus"),
      width: w.status,
      renderHeader: statusFilter
        ? () => (
            <StatusHeaderPopover
              label={t("invoices.list.columnStatus")}
              options={statusFilter.options}
              value={statusFilter.value}
              resetValue="all"
              onChange={statusFilter.onChange}
            />
          )
        : undefined,
      render: (invoice) => <InvoiceStatusChip status={isOverdue(invoice, now) ? "overdue" : invoice.status} size="sm" />,
    },
    {
      key: "nav",
      header: "NAV",
      width: w.nav,
      align: "center",
      render: (invoice) => <NavStateIcon status={invoiceNavStatus(invoice)} />,
    },
    {
      key: "gross",
      header: t("invoices.list.columnGross"),
      width: w.gross,
      align: "right",
      sortable: true,
      render: (invoice) => (
        <Text numeric numberOfLines={1} className="whitespace-nowrap text-sm font-bold text-ink">
          {formatCurrency(calculateInvoiceTotals(invoice.lineItems).totalAmount, invoice.currency)}
        </Text>
      ),
    },
  ];

  const menu = (invoice: Invoice) => (
    <OverflowMenu items={menuItemsFor(invoice)} label={t("invoices.list.rowMenuLabel")} />
  );

  function renderCard(invoice: Invoice) {
    const overdue = isOverdue(invoice, now);
    const label = dueLabel(invoice, now);
    const number = hasInvoiceNumber(invoice) ? invoice.invoiceNumber : t("invoices.status.draft");
    return (
      <ListCardRow
        testID="invoice-card-press"
        title={invoice.clientName}
        amount={formatCurrency(calculateInvoiceTotals(invoice.lineItems).totalAmount, invoice.currency)}
        meta={`${number} · ${formatDateOnly(invoice.issueDate)}`}
        badges={
          <>
            <InvoiceStatusChip status={overdue ? "overdue" : invoice.status} size="sm" />
            <NavStateIcon status={invoiceNavStatus(invoice)} testID="invoice-card-nav-dot" />
            {label?.kind === "overdue" ? (
              <Text testID="invoice-card-overdue-label" className="text-[13px] text-err">
                {t("invoices.list.overdueBy", { days: label.days })}
              </Text>
            ) : null}
          </>
        }
        menu={menu(invoice)}
        onPress={onRowPress ? () => onRowPress(invoice) : undefined}
      />
    );
  }

  return (
    <ListTable
      testID="invoice-list-table"
      rowTestID="invoice-list-row"
      sortTestIDPrefix="invoice-table-sort-"
      columns={columns}
      rows={invoices}
      keyExtractor={(invoice) => invoice.id}
      renderCard={renderCard}
      onRowPress={onRowPress}
      rowMenu={menu}
      sort={sort}
      onSortChange={onSortChange ? (key) => onSortChange(key as InvoiceSortKey) : undefined}
      loading={loading}
      empty={empty}
      footer={footer}
      attachedToTabs={attachedToTabs}
      layout={layout}
    />
  );
}
