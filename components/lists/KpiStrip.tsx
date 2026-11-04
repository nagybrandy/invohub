// components/lists/KpiStrip.tsx
// The Számlák KPI strip (tokens.md §6.8): one card, four cells separated by
// 1px lines; two columns when the strip's own container is <= 820px. A cell
// with `onPress` is a button (hover wash); one without is a plain cell (ÁFA).
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { LAYOUT } from "@/lib/theme/layout";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export type KpiCell = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "err" | "ok";
  /** Applies the matching list filter; omit for a non-interactive cell. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

const TONE_CLASS = { neutral: "text-ink", err: "text-err", ok: "text-ok" } as const;

export function KpiStrip({
  cells,
  loading = false,
  layout,
  testID = "kpi-strip",
}: {
  cells: KpiCell[];
  loading?: boolean;
  layout?: "wide" | "narrow";
  testID?: string;
}) {
  const { width, measured, onLayout } = useMeasuredWidth();
  const window = useWindowDimensions();
  const narrow = layout ? layout === "narrow" : (measured ? width : window.width) <= LAYOUT.listCardsMax;

  return (
    <Box
      testID={testID}
      onLayout={onLayout}
      className="w-full flex-row flex-wrap overflow-hidden rounded-card bg-surface shadow-card"
    >
      {cells.map((cell, index) => {
        // Cell borders: a line to the right of every cell but the last of its
        // row, and above every cell of a second row (narrow: 2 columns).
        const columns = narrow ? 2 : cells.length;
        const lastInRow = (index + 1) % columns === 0;
        const secondRow = index >= columns;
        const border = `${lastInRow ? "" : "border-r border-line"} ${secondRow ? "border-t border-line" : ""}`;
        const body = (
          <Box className={narrow ? "px-3.5 py-3" : "px-[18px] py-3.5"}>
            <Text className="text-[13px] font-medium text-muted-ink">{cell.label}</Text>
            {loading ? (
              <Box className="mt-1.5 h-5 w-24 animate-pulse rounded bg-neutral-wash" />
            ) : (
              <Text
                numberOfLines={1}
                className={`whitespace-nowrap font-heading font-bold tabular-nums ${narrow ? "text-[17px]" : "text-xl"} ${TONE_CLASS[cell.tone ?? "neutral"]}`}
              >
                {cell.value}
              </Text>
            )}
            {cell.sub ? <Text className="text-[13px] text-muted-ink">{cell.sub}</Text> : null}
          </Box>
        );
        const widthClass = narrow ? "w-1/2" : "flex-1 basis-0";
        return cell.onPress ? (
          <Pressable
            key={cell.key}
            testID={`${testID}-${cell.key}`}
            accessibilityRole="button"
            accessibilityLabel={cell.accessibilityLabel ?? `${cell.label}: ${cell.value}`}
            onPress={cell.onPress}
            className={`web:cursor-pointer ${widthClass} ${border} data-[hover=true]:bg-wash2`}
          >
            {body}
          </Pressable>
        ) : (
          <Box key={cell.key} testID={`${testID}-${cell.key}`} className={`${widthClass} ${border}`}>
            {body}
          </Box>
        );
      })}
    </Box>
  );
}
