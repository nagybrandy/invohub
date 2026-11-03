// components/layout/DataTable.tsx
// Desktop data table — every list screen renders the same table instead of
// each screen inventing its own rows (L1). Sortable headers, a right-aligned
// tabular-nums numeric column, a per-row "···" menu, a loading skeleton, and
// a StateView empty fallback. At mobile widths it scrolls horizontally
// instead of overflowing the page (or the caller supplies `renderMobile`
// for a card layout — spec §4.7/§4.8, AC12).
import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { StateView } from "@/components/layout/StateView";
import { LAYOUT } from "@/lib/theme/layout";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export type Column<T> = {
  key: string;
  header: string;
  /** Fixed pixel width; omit for a flexible (flex-1) column. */
  width?: number;
  align?: "left" | "right" | "center";
  /** Right-aligns + tabular-nums when render() returns a string/number. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
  sortable?: boolean;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowPress?: (row: T) => void;
  /** Rendered in the trailing "···" column for each row. */
  rowActions?: (row: T) => ReactNode;
  sort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string) => void;
  /** true → skeleton rows instead of data. */
  loading?: boolean;
  /** Rendered instead of the default StateView when rows is empty. */
  empty?: ReactNode;
  /**
   * Optional card layout. Container-based (tokens.md §6.7): when the table's
   * own measured width is <= 820 it renders cards instead of the table. Until
   * the first layout both are rendered and CSS (tab:) picks one.
   */
  renderMobile?: (row: T) => ReactNode;
};

function alignClasses(column: Pick<Column<unknown>, "align" | "numeric">) {
  const align = column.numeric ? "right" : (column.align ?? "left");
  return {
    justify: align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start",
    items: align === "right" ? "items-end" : align === "center" ? "items-center" : "items-start",
    text: align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
  };
}

function ColumnBox({
  column,
  children,
  className = "",
}: {
  column: Pick<Column<unknown>, "width">;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Box
      className={`${column.width ? "shrink-0" : "flex-1"} ${className}`}
      style={column.width ? { width: column.width } : undefined}
    >
      {children}
    </Box>
  );
}

function HeaderCell<T>({
  column,
  sort,
  onSortChange,
}: {
  column: Column<T>;
  sort?: DataTableProps<T>["sort"];
  onSortChange?: DataTableProps<T>["onSortChange"];
}) {
  const { justify } = alignClasses(column);
  const isSorted = sort?.key === column.key;

  const label = (
    <Text
      size="sm"
      className={`text-[13px] font-medium ${isSorted ? "text-ink" : "text-muted-ink"}`}
    >
      {column.header}
    </Text>
  );

  return (
    <ColumnBox column={column} className={`px-2.5 py-2.5 ${justify} flex-row`}>
      {column.sortable ? (
        <Pressable
          testID={`data-table-sort-${column.key}`}
          onPress={() => onSortChange?.(column.key)}
          accessibilityRole="button"
          className="flex-row items-center gap-1"
        >
          {label}
          <Text
            testID={`data-table-sort-indicator-${column.key}`}
            size="xs"
            className="w-3 text-muted-ink"
          >
            {isSorted ? (sort!.direction === "asc" ? "▲" : "▼") : ""}
          </Text>
        </Pressable>
      ) : (
        label
      )}
    </ColumnBox>
  );
}

function Cell<T>({ column, row }: { column: Column<T>; row: T }) {
  const { items, text } = alignClasses(column);
  const content = column.render(row);
  const isPrimitive = typeof content === "string" || typeof content === "number";

  return (
    <ColumnBox
      column={column}
      className={`justify-center px-2.5 py-2 ${items} ${column.numeric ? "tabular-nums" : ""}`}
    >
      {isPrimitive ? (
        <Text className={`${text} text-sm ${column.numeric ? "font-bold tabular-nums" : ""}`}>
          {content}
        </Text>
      ) : (
        content
      )}
    </ColumnBox>
  );
}

function DataRow<T>({
  row,
  columns,
  onRowPress,
  rowActions,
}: {
  row: T;
  columns: Column<T>[];
  onRowPress?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
}) {
  const cells = (
    <>
      {columns.map((column) => (
        <Cell key={column.key} column={column} row={row} />
      ))}
      {rowActions ? (
        <Box
          testID="data-table-row-actions"
          className="w-11 shrink-0 items-center justify-center px-2 py-2"
          style={{ width: 44 }}
        >
          {rowActions(row)}
        </Box>
      ) : null}
    </>
  );

  if (onRowPress) {
    return (
      <Pressable
        testID="data-table-row"
        onPress={() => onRowPress(row)}
        // No accessibilityRole="button" here: on web that renders a real
        // <button>, and a row can carry its own interactive rowActions
        // (an OverflowMenu trigger, itself a button) — a <button> can never
        // legally contain another <button> (invalid HTML, and the nested
        // one gets silently hoisted out of the DOM by the browser).
        className="web:cursor-pointer min-h-[56px] flex-row items-center border-b border-line data-[hover=true]:bg-wash2"
      >
        {cells}
      </Pressable>
    );
  }

  return (
    <Box testID="data-table-row" className="min-h-[56px] flex-row items-center border-b border-line">
      {cells}
    </Box>
  );
}

function SkeletonRows<T>({ columns, rowActions }: { columns: Column<T>[]; rowActions?: unknown }) {
  return (
    <VStack testID="data-table-skeleton" space="xs" className="p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <HStack key={i} space="md" className="items-center px-1 py-1.5">
          {columns.map((column) => (
            <ColumnBox key={column.key} column={column}>
              <Box className="h-4 w-full animate-pulse rounded bg-neutral-wash" />
            </ColumnBox>
          ))}
          {rowActions ? <Box style={{ width: 44 }} /> : null}
        </HStack>
      ))}
    </VStack>
  );
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  rowActions,
  sort,
  onSortChange,
  loading = false,
  empty,
  renderMobile,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { width, measured, onLayout } = useMeasuredWidth();

  if (loading) {
    return (
      <Box testID="data-table" className="w-full overflow-hidden rounded-card bg-surface shadow-card">
        <SkeletonRows columns={columns} rowActions={rowActions} />
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box testID="data-table">
        {empty ?? <StateView kind="empty" title={t("states.emptyTitle")} />}
      </Box>
    );
  }

  const table = (
    <Box className="min-w-full">
      <Box testID="data-table-header" className="flex-row items-center border-b border-line bg-wash2">
        {columns.map((column) => (
          <HeaderCell key={column.key} column={column} sort={sort} onSortChange={onSortChange} />
        ))}
        {rowActions ? <Box style={{ width: 44 }} /> : null}
      </Box>
      {rows.map((row) => (
        <DataRow
          key={keyExtractor(row)}
          row={row}
          columns={columns}
          onRowPress={onRowPress}
          rowActions={rowActions}
        />
      ))}
    </Box>
  );

  // true = cards, false = table, null = not measured yet (CSS decides).
  const cards: boolean | null = !renderMobile ? false : measured ? width <= LAYOUT.listCardsMax : null;

  return (
    <Box
      testID="data-table"
      onLayout={onLayout}
      className="w-full overflow-hidden rounded-card bg-surface shadow-card"
    >
      {renderMobile && cards !== false ? (
        <Box testID="data-table-mobile" className={cards === null ? "tab:hidden" : ""}>
          <VStack>
            {rows.map((row) => (
              <Box key={keyExtractor(row)}>{renderMobile(row)}</Box>
            ))}
          </VStack>
        </Box>
      ) : null}
      {cards !== true ? (
        <ScrollView
          testID="data-table-scroll"
          horizontal
          showsHorizontalScrollIndicator={false}
          className={renderMobile && cards === null ? "hidden tab:flex" : undefined}
        >
          {table}
        </ScrollView>
      ) : null}
    </Box>
  );
}
