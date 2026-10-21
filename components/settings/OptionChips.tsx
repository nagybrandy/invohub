// components/settings/OptionChips.tsx
// A row of mutually exclusive chips for a settings choice. Pressing the
// selected chip again clears it (for optional settings such as the tax mode).
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

export type ChipOption<T extends string | number> = { value: T; label: string };

export function OptionChips<T extends string | number>({
  options,
  value,
  onChange,
  clearable = false,
  testIDPrefix,
}: {
  options: readonly ChipOption<T>[];
  value: T | undefined | null;
  onChange: (value: T | undefined) => void;
  /** Pressing the selected chip again clears it. */
  clearable?: boolean;
  testIDPrefix: string;
}) {
  return (
    <HStack space="sm" className="flex-wrap">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(selected && clearable ? undefined : option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`${testIDPrefix}-${String(option.value)}`}
            className={`mb-2 items-center justify-center rounded-lg border px-4 py-2 ${TAP_TARGET_MIN_H} ${
              selected ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Text size="sm" className={selected ? "font-semibold text-primary" : "text-foreground"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
