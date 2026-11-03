// components/lists/ListTable.tsx
// The one list pattern behind Számlák, Nyugták, Partnerek and Termékek
// (tokens.md §6.6 / §6.7): a card that holds a table when the list's OWN
// container is wider than 820px and plain cards otherwise (React Native has no
// container queries, so the width comes from onLayout). Header = wash2, 13px
// muted; rows = 56px with a hover wash; a menu column at the end; an optional
// footer strip inside the card. Loading / empty states replace the table (they
// are never a FlatList child, AGENTS.md §3).
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { StateView } from "@/components/layout/StateView";
import { useIconColors } from "@/lib/theme/icon-colors";
import { LAYOUT } from "@/lib/theme/layout";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export type ListColumn<T> = {
  key: string;
  header: string;
  /** Replaces the plain header label (e.g. the Státusz popover trigger). */
  renderHeader?: () => React.ReactNode;
  /** Fixed width in px; omit for a flexible column. */
  width?: number;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
};

export type ListSort = { key: string; direction: "asc" | "desc" };

export type ListTableProps<T> = {
  columns: ListColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  /** Card layout for one row; without it the table is always used. */
  renderCard?: (row: T) => React.ReactNode;
  onRowPress?: (row: T) => void;
  /** The trailing "..." menu cell. */
  rowMenu?: (row: T) => React.ReactNode;
  sort?: ListSort;
  onSortChange?: (key: string) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  /** Rendered inside the card, under the rows (totals strip). */
  footer?: React.ReactNode;
  /** The card sits right under the status tabs: flat top corners. */
  attachedToTabs?: boolean;
  /** Skip the measurement (tests, a known container). */
  layout?: "table" | "cards";
  sortTestIDPrefix?: string;
  rowTestID?: string;
  testID?: string;
};

const MENU_COL_WIDTH = 44;

function alignClass(align: ListColumn<unknown>["align"]) {
  return align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
}

function CellBox({
  width,
  align,
  className = "",
  children,
}: {
  width?: number;
  align?: ListColumn<unknown>["align"];
  className?: string;
  children?: React.ReactNode;
}) {
  const items = align === "right" ? "items-end" : align === "center" ? "items-center" : "items-start";
  return (
    <Box
      className={`${width ? "shrink-0" : "min-w-0 flex-1"} px-2.5 ${items} ${className}`}
      style={width ? { width } : undefined}
    >
      {children}
    </Box>
  );
}

function HeaderCell<T>({
  column,
  sort,
  onSortChange,
  sortTestIDPrefix,
}: {
  column: ListColumn<T>;
  sort?: ListSort;
  onSortChange?: (key: string) => void;
  sortTestIDPrefix: string;
}) {
  const icons = useIconColors();
  const sorted = sort?.key === column.key;
  const label = (
    <Text size="sm" className={`text-[13px] font-medium ${sorted ? "text-ink" : "text-muted-ink"}`}>
      {column.header}
    </Text>
  );

  let content: React.ReactNode = label;
  if (column.renderHeader) {
    content = column.renderHeader();
  } else if (column.sortable && onSortChange) {
    content = (
      <Pressable
        testID={`${sortTestIDPrefix}${column.key}`}
        accessibilityRole="button"
        accessibilityLabel={column.header}
        onPress={() => onSortChange(column.key)}
        className="min-h-[34px] flex-row items-center gap-1 justify-center"
      >
        {label}
        {sorted ? (
          sort?.direction === "asc" ? (
            <ArrowUp size={13} color={icons.foreground} />
          ) : (
            <ArrowDown size={13} color={icons.foreground} />
          )
        ) : null}
      </Pressable>
    );
  }

  return (
    <CellBox width={column.width} align={column.align} className="py-1.5">
      <HStack className={`items-center ${alignClass(column.align)}`}>{content}</HStack>
    </CellBox>
  );
}

export function ListTable<T>({
  columns,
  rows,
  keyExtractor,
  renderCard,
  onRowPress,
  rowMenu,
  sort,
  onSortChange,
  loading = false,
  empty,
  footer,
  attachedToTabs = false,
  layout,
  sortTestIDPrefix = "list-table-sort-",
  rowTestID = "list-table-row",
  testID = "list-table",
}: ListTableProps<T>) {
  const { width, measured, onLayout } = useMeasuredWidth();
  const window = useWindowDimensions();

  const radius = attachedToTabs ? "rounded-b-card" : "rounded-card";
  const frame = `w-full overflow-hidden ${radius} bg-surface shadow-card`;

  if (loading && rows.length === 0) {
    return (
      <Box testID={testID} className={frame}>
        <StateView kind="loading" title="" rows={6} />
      </Box>
    );
  }

  if (rows.length === 0) {
    return <Box testID={testID}>{empty}</Box>;
  }

  // Until the first layout the window decides (phones never flash a table).
  const useCards = !renderCard
    ? false
    : layout
      ? layout === "cards"
      : (measured ? width : window.width) <= LAYOUT.listCardsMax;

  return (
    <Box testID={testID} onLayout={onLayout} className={frame}>
      {useCards && renderCard ? (
        <VStack testID={`${testID}-cards`}>
          {rows.map((row) => (
            <Box key={keyExtractor(row)} className="border-b border-line last:border-b-0">
              {renderCard(row)}
            </Box>
          ))}
        </VStack>
      ) : (
        <VStack testID={`${testID}-table`}>
          <Box
            testID="list-table-header"
            className="flex-row items-center border-b border-line bg-wash2 px-2 py-1"
          >
            {columns.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                onSortChange={onSortChange}
                sortTestIDPrefix={sortTestIDPrefix}
              />
            ))}
            {rowMenu ? <Box style={{ width: MENU_COL_WIDTH }} className="shrink-0" /> : null}
          </Box>
          {rows.map((row) => {
            const cells = (
              <>
                {columns.map((column) => (
                  <CellBox key={column.key} width={column.width} align={column.align} className="justify-center py-2">
                    {column.render(row)}
                  </CellBox>
                ))}
                {rowMenu ? (
                  <Box style={{ width: MENU_COL_WIDTH }} className="shrink-0 items-center justify-center">
                    {rowMenu(row)}
                  </Box>
                ) : null}
              </>
            );
            // No accessibilityRole on the pressable row: on web that would be a
            // <button> holding the menu's own <button> (invalid HTML).
            return onRowPress ? (
              <Pressable
                key={keyExtractor(row)}
                testID={rowTestID}
                onPress={() => onRowPress(row)}
                className="web:cursor-pointer min-h-[56px] flex-row items-center border-b border-line px-2 last:border-b-0 data-[hover=true]:bg-wash2"
              >
                {cells}
              </Pressable>
            ) : (
              <Box key={keyExtractor(row)} testID={rowTestID} className="min-h-[56px] flex-row items-center border-b border-line px-2 last:border-b-0">
                {cells}
              </Box>
            );
          })}
        </VStack>
      )}
      {footer ? (
        <Box testID={`${testID}-footer`} className="border-t border-line bg-wash2 px-4 py-3">
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
