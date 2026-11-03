// components/ui/segmented-control/index.tsx
// The one segmented control (tokens.md §6.1): a track of equal segments for
// small fixed choices (Számla / Díjbekérő / Előlegszámla, Összes /
// Olvasatlan, Bejelentkezés / Regisztráció). Semantics: role="radiogroup" with
// role="radio" segments and aria-checked; roving tabindex (only the selected
// segment is a tab stop) and arrow keys move the selection, the way native
// radio groups do.
import * as React from "react";
import { Platform } from "react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export type SegmentedControlProps<T extends string = string> = {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** md: 36px segments (default). sm: 30px, 13px text, labels wrap. */
  size?: "md" | "sm";
  /** Stretch across the container instead of the 520px cap (composer type switch). */
  fullWidth?: boolean;
  /** Inset 1px seg-line outline, for use on a white card. */
  outlined?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  className?: string;
};

type KeyEvent = {
  key?: string;
  nativeEvent?: { key?: string };
  preventDefault?: () => void;
};

/** Next enabled index for an arrow/Home/End key, or null when the key is not ours. */
export function nextSegmentIndex(
  key: string,
  current: number,
  disabled: ReadonlyArray<boolean>,
): number | null {
  const count = disabled.length;
  if (count === 0) return null;
  const step = (from: number, dir: 1 | -1): number | null => {
    for (let i = 1; i <= count; i += 1) {
      const idx = (from + dir * i + count * i) % count;
      if (!disabled[idx]) return idx;
    }
    return null;
  };
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return step(current, 1);
    case "ArrowLeft":
    case "ArrowUp":
      return step(current, -1);
    case "Home":
      return disabled.findIndex((d) => !d) >= 0 ? disabled.findIndex((d) => !d) : null;
    case "End": {
      for (let i = count - 1; i >= 0; i -= 1) if (!disabled[i]) return i;
      return null;
    }
    default:
      return null;
  }
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  outlined = false,
  accessibilityLabel,
  testID = "segmented-control",
  className = "",
}: SegmentedControlProps<T>) {
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
    const target = nextSegmentIndex(
      key,
      index,
      options.map((o) => Boolean(o.disabled)),
    );
    if (target == null) return;
    event.preventDefault?.();
    if (options[target].value !== value) {
      pendingFocus.current = target;
      onChange(options[target].value);
    } else {
      refs.current[target]?.focus?.();
    }
  }

  const small = size === "sm";
  const trackClass = [
    "flex-row gap-1 bg-seg-track p-1 w-full",
    small ? "rounded-[10px]" : "rounded-xl",
    fullWidth ? "" : "max-w-[520px]",
    outlined ? "border border-seg-line" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={trackClass}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const disabled = Boolean(option.disabled);
        const segmentClass = [
          "min-w-0 flex-1 items-center justify-center px-3",
          small ? "min-h-[30px] rounded-[7px]" : "min-h-9 rounded-control",
          selected ? "bg-seg-active" : "data-[hover=true]:bg-seg-hover",
          disabled ? "opacity-[0.45]" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const textClass = [
          small ? "text-[13px]" : "text-sm",
          "text-center leading-[1.3]",
          selected ? "font-medium text-seg-active-ink" : "font-normal text-seg-ink",
        ].join(" ");
        const keyProps = { onKeyDown: (e: KeyEvent) => handleKeyDown(e, index) } as Record<string, unknown>;
        return (
          <Pressable
            key={option.value}
            ref={(node) => {
              refs.current[index] = node as unknown as { focus?: () => void } | null;
            }}
            testID={option.testID ?? `${testID}-${option.value}`}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected, selected, disabled }}
            // react-native-web does not derive aria-checked from the state.
            aria-checked={selected}
            // Roving tabindex: the radiogroup is ONE tab stop.
            {...(Platform.OS === "web" ? { tabIndex: selected ? 0 : -1 } : {})}
            disabled={disabled}
            onPress={() => {
              if (!disabled && !selected) onChange(option.value);
            }}
            className={segmentClass}
            {...keyProps}
          >
            <Text numberOfLines={small ? undefined : 1} className={textClass}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}
