// components/settings/ThemeCards.tsx
// Világos / Sötét / Rendszer szerint as three preview cards (tokens.md §6.17).
// A radiogroup: one tab stop, arrow keys move AND select (the way native radio
// groups do), Home / End jump to the ends. The previews always show their own
// scheme (light, dark, half-and-half), so they read from `designPalette`
// instead of the active theme.
import * as React from "react";
import { Platform } from "react-native";
import { Check } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { nextSegmentIndex } from "@/components/ui/segmented-control";
import type { ThemePreference } from "@/lib/theme-preference";
import { designPalette, iconColors } from "@/lib/theme/tokens";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export type ThemeCardOption = { value: ThemePreference; label: string };

type KeyEvent = { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void };

/** Below this container width the cards stack as rows with a small preview. */
export const THEME_CARDS_NARROW_MAX = 520;

type Palette = Record<keyof (typeof designPalette)["light"], string>;

function MiniPreview({ palette, width, height }: { palette: Palette; width?: number; height: number }) {
  return (
    <Box
      aria-hidden
      className="flex-row overflow-hidden rounded-control"
      style={{ width: width ?? "100%", height, backgroundColor: palette.canvas }}
    >
      <Box style={{ width: "22%", backgroundColor: palette.navy }} />
      <Box className="flex-1 justify-center gap-1.5 px-2">
        <Box className="rounded-full" style={{ height: 5, width: "60%", backgroundColor: palette["neutral-wash"] }} />
        <Box
          className="gap-1 rounded-md px-1.5 py-1"
          style={{ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }}
        >
          <Box className="rounded-full" style={{ height: 4, width: "55%", backgroundColor: palette.primary }} />
        </Box>
      </Box>
    </Box>
  );
}

function SystemPreview({ width, height }: { width?: number; height: number }) {
  // Left half light, right half dark, one shared navy strip.
  return (
    <Box aria-hidden className="relative overflow-hidden rounded-control" style={{ width: width ?? "100%", height }}>
      <Box className="absolute inset-0 flex-row">
        <Box className="flex-1" style={{ backgroundColor: designPalette.light.canvas }} />
        <Box className="flex-1" style={{ backgroundColor: designPalette.dark.canvas }} />
      </Box>
      <Box className="absolute inset-0 flex-row">
        <Box style={{ width: "22%", backgroundColor: designPalette.light.navy }} />
        <Box className="flex-1 justify-center gap-1.5 px-2">
          <Box className="flex-row">
            <Box className="rounded-l-full" style={{ height: 5, width: "30%", backgroundColor: designPalette.light["neutral-wash"] }} />
            <Box className="rounded-r-full" style={{ height: 5, width: "30%", backgroundColor: designPalette.dark["neutral-wash"] }} />
          </Box>
          <Box className="flex-row overflow-hidden rounded-md" style={{ height: 18 }}>
            <Box className="flex-1 justify-center px-1.5" style={{ backgroundColor: designPalette.light.surface }}>
              <Box className="rounded-full" style={{ height: 4, width: "80%", backgroundColor: designPalette.light.primary }} />
            </Box>
            <Box className="flex-1 justify-center px-1.5" style={{ backgroundColor: designPalette.dark.surface }}>
              <Box className="rounded-full" style={{ height: 4, width: "80%", backgroundColor: designPalette.dark.primary }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export function ThemeCards({
  value,
  onChange,
  options,
  accessibilityLabel,
  testID = "theme-cards",
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
  options: readonly ThemeCardOption[];
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { width, measured, onLayout } = useMeasuredWidth();
  const narrow = measured && width <= THEME_CARDS_NARROW_MAX;
  const refs = React.useRef<Array<{ focus?: () => void } | null>>([]);
  const pendingFocus = React.useRef<number | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

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
    <Box
      testID={testID}
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={narrow ? "gap-3" : "flex-row gap-3"}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const preview =
          option.value === "system" ? (
            <SystemPreview width={narrow ? 84 : undefined} height={narrow ? 56 : 78} />
          ) : (
            <MiniPreview
              palette={option.value === "dark" ? designPalette.dark : designPalette.light}
              width={narrow ? 84 : undefined}
              height={narrow ? 56 : 78}
            />
          );
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
            className={`rounded-card bg-surface ${narrow ? "flex-row items-center gap-3 p-2" : "min-w-0 flex-1 p-2 pb-3"} ${
              selected ? "border-[1.5px] border-primary" : "border-[1.5px] border-line-strong"
            } data-[hover=true]:bg-wash2`}
            {...keyProps}
          >
            {preview}
            <Box className={narrow ? "min-w-0 flex-1 flex-row items-center justify-between" : "mt-2.5 flex-row items-start justify-between gap-2 px-1"}>
              <Text className="min-w-0 flex-shrink text-sm font-semibold text-ink">{option.label}</Text>
              {selected ? (
                <Box
                  aria-hidden
                  testID={`${testID}-${option.value}-check`}
                  className="h-4 w-4 items-center justify-center rounded-full bg-primary"
                >
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
