// components/invoices/InvoiceListTable.tsx
// Kept as the stable import path for the invoice table (the dashboard's
// "recent invoices" panel uses it). The implementation moved to
// components/lists/InvoiceList (redesign 2026-11): one shared table / card
// component for Számlák and Főoldal. This wrapper only keeps the old prop
// names and re-exports the sort types.
import type { ReactNode } from "react";
import { InvoiceList, type InvoiceStatusFilterProps } from "@/components/lists/InvoiceList";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import type { Invoice } from "@/lib/invoices/types";
import type { InvoiceListSort, InvoiceSortKey } from "@/lib/lists/invoice-sort";

export type { InvoiceListSort, InvoiceSortKey } from "@/lib/lists/invoice-sort";

export function InvoiceListTable({
  invoices,
  loading = false,
  now,
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
}: {
  invoices: Invoice[];
  loading?: boolean;
  now?: Date;
  sort?: InvoiceListSort;
  onSortChange?: (key: InvoiceSortKey) => void;
  onRowPress?: (invoice: Invoice) => void;
  menuItemsFor: (invoice: Invoice) => OverflowMenuItem[];
  empty?: ReactNode;
  /** proformaId -> its live conversion's invoice id — drives the "Számlázva" sub-label. */
  convertedIds?: Record<string, string>;
  statusFilter?: InvoiceStatusFilterProps;
  footer?: ReactNode;
  attachedToTabs?: boolean;
  /** Force the table or the cards; by default the list's own width decides. */
  layout?: "table" | "cards";
}) {
  return (
    <InvoiceList
      invoices={invoices}
      loading={loading}
      now={now}
      sort={sort}
      onSortChange={onSortChange}
      onRowPress={onRowPress}
      menuItemsFor={menuItemsFor}
      empty={empty}
      convertedIds={convertedIds}
      statusFilter={statusFilter}
      footer={footer}
      attachedToTabs={attachedToTabs}
      layout={layout}
    />
  );
}
