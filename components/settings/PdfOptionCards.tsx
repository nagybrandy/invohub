// components/settings/PdfOptionCards.tsx
// Betűstílus / Elrendezés as selectable cards (Dóri's .pcard): a small sample
// on top, the name below. A radiogroup with roving tab stop; arrow keys move
// and select, like the theme cards. The samples are drawn with Boxes (never
// RN style arrays), the hex colours are invoice DATA, not interface colours.
import * as React from "react";
import { Platform } from "react-native";
import { Check } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { nextSegmentIndex } from "@/components/ui/segmented-control";
import { iconColors } from "@/lib/theme/tokens";
import type { PdfLayout } from "@/lib/invoices/pdf-template/types";

export type PdfCardOption<T extends string> = {
  value: T;
  label: string;
  sample: React.ReactNode;
};

type KeyEvent = { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void };

export function PdfOptionCards<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  options: ReadonlyArray<PdfCardOption<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID: string;
}) {
  const refs = React.useRef<Array<{ focus?: () => void } | null>>([]);
  const pendingFocus = React.useRef<number | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  React.useEffect(() => {
    if (pendingFocus.current == null) return;
    refs.current[pendingFocus.current]?.focus?.();
    pendingFocus.current = null;
  }, [value]);

  function handleKeyDown(event: KeyEvent, index: number) {
    const key = event.key ?? event.nativeEvent?.key ?? "";
    const target = nextSegmentIndex(key, index, options.map(() => false));
    if (target == null) return;
    event.preventDefault?.();
    if (options[target].value !== value) {
      pendingFocus.current = target;
      onChange(options[target].value);
    } else {
      refs.current[target]?.focus?.();
    }
  }

  return (
    <Box testID={testID} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row flex-wrap gap-3">
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const keyProps = { onKeyDown: (e: KeyEvent) => handleKeyDown(e, index) } as Record<string, unknown>;
        return (
          <Pressable
            key={option.value}
            ref={(node) => {
              refs.current[index] = node as unknown as { focus?: () => void } | null;
            }}
            testID={`${testID}-${option.value}`}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, selected }}
            aria-checked={selected}
            {...(Platform.OS === "web" ? { tabIndex: selected ? 0 : -1 } : {})}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            className={`min-w-[96px] flex-1 rounded-card bg-surface p-2 pb-3 ${
              selected ? "border-[1.5px] border-primary" : "border-[1.5px] border-line-strong"
            } data-[hover=true]:bg-wash2`}
            {...keyProps}
          >
            <Box className="h-[64px] items-center justify-center overflow-hidden rounded-control bg-wash2">{option.sample}</Box>
            <Box className="mt-2.5 flex-row items-center justify-between gap-2 px-1">
              <Text className="min-w-0 flex-shrink text-sm font-semibold text-ink">{option.label}</Text>
              {selected ? (
                <Box aria-hidden className="h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check size={11} color={iconColors.light.onNavyActive} strokeWidth={3} />
                </Box>
              ) : null}
            </Box>
          </Pressable>
        );
      })}
    </Box>
  );
}

/** A tiny page wireframe in the layout's own treatment (header, meta strip, table head). */
export function LayoutThumb({ layout, color }: { layout: PdfLayout; color: string }) {
  const framed = layout === "frame";
  const band = layout === "band";
  return (
    <Box aria-hidden className="h-[52px] w-[40px] gap-[3px] rounded-[3px] bg-white p-[4px]">
      <Box className="h-[3px] w-[60%] rounded-full" style={{ backgroundColor: color }} />
      <Box className="h-px w-full" style={{ backgroundColor: color }} />
      <Box
        className={`h-[7px] w-full ${framed ? "rounded-[2px] border" : ""}`}
        style={{ backgroundColor: band || framed ? `${color}22` : "#ffffff", borderColor: color }}
      />
      <Box
        className="h-[5px] w-full"
        style={{ backgroundColor: band || framed ? color : "#ffffff", borderBottomWidth: layout === "clean" ? 1 : 0, borderColor: color }}
      />
      <Box className="h-px w-full bg-neutral-300" />
      <Box className="h-px w-full bg-neutral-300" />
    </Box>
  );
}
