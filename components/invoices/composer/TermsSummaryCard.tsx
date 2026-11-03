// components/invoices/composer/TermsSummaryCard.tsx
// "Dátumok és fizetés" as a one-line summary (tokens.md §6.18): cells with a
// 12px muted label over a 600 value, a --wash2 footer line with the reason
// text and a "Módosítás" link that expands the edit grid underneath. Four
// cells in a row from 701px, two by two on phones.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type TermsCell = { key: string; label: string; value: string };

/** Border classes of cell `index` of `count`: a right rule between cells, a bottom rule under the first phone row. */
export function termsCellBorderClass(index: number, count: number): string {
  const lastInRow = index === count - 1;
  const phoneRightRule = index % 2 === 0 && index < count - 1 ? "phone:border-r" : "phone:border-r-0";
  const phoneBottomRule = count > 2 && index < 2 ? "phone:border-b" : "phone:border-b-0";
  const wideRule = lastInRow ? "tab:border-r-0" : "tab:border-r";
  return `border-line ${phoneRightRule} ${phoneBottomRule} ${wideRule}`;
}

export function TermsSummaryCard({
  cells,
  footer,
  expanded,
  onToggle,
  editLabel,
  doneLabel,
  children,
  testID = "composer-terms",
}: {
  cells: TermsCell[];
  footer: string;
  expanded: boolean;
  onToggle: () => void;
  editLabel: string;
  doneLabel: string;
  /** The edit grid, mounted only while expanded. */
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Box className="overflow-hidden rounded-card border border-line-strong bg-surface" testID={testID}>
      <Box className="flex-row flex-wrap" testID={`${testID}-summary`}>
        {cells.map((cell, index) => (
          <Box
            key={cell.key}
            className={`w-1/2 px-3.5 py-[11px] tab:w-auto tab:flex-1 ${termsCellBorderClass(index, cells.length)}`}
            testID={`${testID}-cell-${cell.key}`}
          >
            <Text className="text-xs text-muted-ink">{cell.label}</Text>
            <Text className="text-sm font-semibold text-ink tabular-nums">{cell.value}</Text>
          </Box>
        ))}
      </Box>
      <Box className="flex-row items-center justify-between gap-3 border-t border-line bg-wash2 px-3.5 py-2.5">
        <Text className="min-w-0 flex-1 text-[13px] text-muted-ink">{footer}</Text>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          aria-expanded={expanded}
          accessibilityState={{ expanded }}
          testID={`${testID}-toggle`}
          className="min-h-10 justify-center"
        >
          <Text className="text-[13px] font-bold text-primary">{expanded ? doneLabel : editLabel}</Text>
        </Pressable>
      </Box>
      {expanded ? (
        <Box className="border-t border-line p-[22px] phone:p-4" testID={`${testID}-edit`}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
