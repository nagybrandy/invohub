// components/invoices/InvoiceListTable.tsx
// Desktop invoice table: header + InvoiceListRow rows, in the same visual
// language as components/layout/DataTable (rounded-xl border, muted header,
// sortable columns with a visible arrow) — the dashboard already rendered
// invoices as a table; the /invoices list now shares this instead of a
// stretched mobile card list (L1). Reused by both /invoices (sortable) and
// the dashboard's "recent invoices" panel (sort props are optional).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  InvoiceListRow,
  INVOICE_LIST_ROW_COLUMN_WIDTHS,
} from "@/components/invoices/InvoiceListRow";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { StateView } from "@/components/layout/StateView";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { Invoice } from "@/lib/invoices/types";

export type InvoiceSortKey = "issued" | "due" | "gross";
export type InvoiceListSort = { key: InvoiceSortKey; direction: "asc" | "desc" };

const SORTABLE_KEYS: InvoiceSortKey[] = ["issued", "due", "gross"];

export function InvoiceListTable({
  invoices,
  loading = false,
  now = new Date(),
  sort,
  onSortChange,
  onRowPress,
  menuItemsFor,
  empty,
}: {
  invoices: Invoice[];
  loading?: boolean;
  now?: Date;
  sort?: InvoiceListSort;
  onSortChange?: (key: InvoiceSortKey) => void;
  onRowPress?: (invoice: Invoice) => void;
  menuItemsFor: (invoice: Invoice) => OverflowMenuItem[];
  empty?: ReactNode;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const w = INVOICE_LIST_ROW_COLUMN_WIDTHS;

  if (loading && invoices.length === 0) {
    return (
      <Box className="rounded-xl border border-subtle p-4">
        <StateView kind="loading" title="" rows={6} />
      </Box>
    );
  }

  if (!loading && invoices.length === 0) {
    return <Box className="rounded-xl border border-subtle">{empty}</Box>;
  }

  const columns: { key: InvoiceSortKey | string; label: string; width: number; align?: "right" | "center" }[] = [
    { key: "serial", label: t("invoices.list.columnNumber"), width: w.serial },
    { key: "partner", label: t("invoices.list.columnPartner"), width: 0 },
    { key: "issued", label: t("invoices.list.columnIssued"), width: w.issued },
    { key: "due", label: t("invoices.list.columnDue"), width: w.due },
    { key: "status", label: t("invoices.list.columnStatus"), width: w.status },
    { key: "nav", label: "NAV", width: w.nav, align: "center" },
    { key: "gross", label: t("invoices.list.columnGross"), width: w.gross, align: "right" },
  ];

  return (
    <Box className="overflow-hidden rounded-xl border border-subtle" testID="invoice-list-table">
      <HStack className="border-b border-subtle bg-muted/40 px-4 py-2.5">
        {columns.map((col) => {
          const sortable = onSortChange && SORTABLE_KEYS.includes(col.key as InvoiceSortKey);
          const isSorted = sort?.key === col.key;
          const alignClass =
            col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start";
          const content = (
            <HStack space="xs" className={`items-center ${alignClass}`}>
              <Text size="xs" className="font-medium uppercase tracking-wide text-muted-foreground">
                {col.label}
              </Text>
              {isSorted ? (
                sort?.direction === "asc" ? (
                  <ArrowUp size={12} color={icons.muted} />
                ) : (
                  <ArrowDown size={12} color={icons.muted} />
                )
              ) : null}
            </HStack>
          );
          return (
            <Box
              key={col.key}
              className={col.width ? "" : "min-w-0 flex-1 pr-2"}
              style={col.width ? { width: col.width } : undefined}
            >
              {sortable ? (
                <Pressable
                  testID={`invoice-table-sort-${col.key}`}
                  onPress={() => onSortChange!(col.key as InvoiceSortKey)}
                  accessibilityRole="button"
                >
                  {content}
                </Pressable>
              ) : (
                content
              )}
            </Box>
          );
        })}
        <Box className="w-11" />
      </HStack>

      {invoices.map((invoice) => (
        <InvoiceListRow
          key={invoice.id}
          invoice={invoice}
          now={now}
          onPress={onRowPress}
          menuItems={menuItemsFor(invoice)}
        />
      ))}
    </Box>
  );
}
