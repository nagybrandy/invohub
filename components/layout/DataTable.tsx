// components/layout/DataTable.tsx
// Shared desktop table: the dashboard already had one (L1's "the app knows
// how to do this and doesn't"); every desktop list now uses this instead of
// re-implementing its own. Callers render cards on mobile.
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { StateView } from "@/components/layout/StateView";
import { useIconColors } from "@/lib/theme/icon-colors";

export type Column<T> = {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
  numeric?: boolean;
  render: (row: T) => ReactNode;
  sortable?: boolean;
};

export type DataTableSort = { key: string; direction: "asc" | "desc" };

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowPress?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  sort?: DataTableSort;
  onSortChange?: (key: string) => void;
  loading?: boolean;
  empty?: ReactNode;
  /** Extra className on each row Pressable — e.g. to strike through cancelled rows. */
  rowClassName?: (row: T) => string;
};

function alignClass(align: Column<never>["align"], numeric?: boolean) {
  const effective = align ?? (numeric ? "right" : "left");
  if (effective === "right") return "items-end text-right";
  if (effective === "center") return "items-center text-center";
  return "items-start text-left";
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
  rowClassName,
}: DataTableProps<T>) {
  const icons = useIconColors();

  if (loading && rows.length === 0) {
    return (
      <Box className="rounded-xl border border-subtle p-4">
        <StateView kind="loading" title="" rows={6} />
      </Box>
    );
  }

  if (!loading && rows.length === 0) {
    return <Box className="rounded-xl border border-subtle">{empty}</Box>;
  }

  return (
    <Box className="overflow-hidden rounded-xl border border-subtle" testID="data-table">
      <HStack className="border-b border-subtle bg-muted/40 px-4 py-2.5">
        {columns.map((col) => {
          const isSorted = sort?.key === col.key;
          const content = (
            <HStack space="xs" className={`items-center ${alignClass(col.align, col.numeric)}`}>
              <Text size="xs" className="font-medium uppercase tracking-wide text-muted-foreground">
                {col.header}
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
              className={col.width ? "" : "flex-1"}
              style={col.width ? { width: col.width } : undefined}
            >
              {col.sortable && onSortChange ? (
                <Pressable
                  testID={`data-table-sort-${col.key}`}
                  onPress={() => onSortChange(col.key)}
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
        {rowActions ? <Box className="w-11" /> : null}
      </HStack>

      {rows.map((row) => {
        const key = keyExtractor(row);
        return (
          <Pressable
            key={key}
            testID="data-table-row"
            onPress={onRowPress ? () => onRowPress(row) : undefined}
            className={`flex-row items-center border-b border-subtle px-4 py-3 last:border-b-0 data-[hover=true]:bg-muted/40 ${
              rowClassName ? rowClassName(row) : ""
            }`}
          >
            {columns.map((col) => (
              <Box
                key={col.key}
                className={col.width ? alignClass(col.align, col.numeric) : `flex-1 ${alignClass(col.align, col.numeric)}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.numeric ? (
                  <Text numeric className="text-sm text-foreground">
                    {col.render(row)}
                  </Text>
                ) : (
                  (() => {
                    const rendered = col.render(row);
                    // A plain string/number would be a bare text node inside
                    // a View on native — always wrap it in <Text>. A caller
                    // that already returns JSX (e.g. its own <Text>, a chip)
                    // is left exactly as rendered.
                    return typeof rendered === "string" || typeof rendered === "number" ? (
                      <Text size="sm" className="text-foreground">
                        {rendered}
                      </Text>
                    ) : (
                      rendered
                    );
                  })()
                )}
              </Box>
            ))}
            {rowActions ? (
              <Box className="w-11 items-end" onStartShouldSetResponder={() => true}>
                {rowActions(row)}
              </Box>
            ) : null}
          </Pressable>
        );
      })}
    </Box>
  );
}
