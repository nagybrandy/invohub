// components/ui/select/index.tsx
// Native select (tokens.md §6.3): a 42px field that opens the options in a
// bottom sheet / dialog as a radio list. The web build (index.web.tsx) uses a
// real <select> so the browser's own picker, typeahead and keyboard work.
import * as React from "react";
import { Check, ChevronDown } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Sheet } from "@/components/ui/sheet";
import { useIconColors } from "@/lib/theme/icon-colors";
import { SELECT_HEIGHT_PX, type SelectProps } from "@/components/ui/select/types";

export type { SelectOption, SelectProps } from "@/components/ui/select/types";
export { SELECT_HEIGHT_PX } from "@/components/ui/select/types";

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  invalid = false,
  accessibilityLabel,
  testID = "select",
  className = "",
  tone = "default",
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const icons = useIconColors();
  const selected = options.find((option) => option.value === value);
  const onNavy = tone === "onNavy";

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={selected ? { text: selected.label } : undefined}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{ height: SELECT_HEIGHT_PX }}
        className={`w-full flex-row items-center justify-between gap-2 rounded-control border px-3 ${
          onNavy ? "border-white/[0.22] bg-transparent" : `bg-surface ${invalid ? "border-err" : "border-line-strong"}`
        } ${disabled && !onNavy ? "bg-wash2" : ""} ${className}`}
      >
        <Text
          numberOfLines={1}
          className={`flex-1 text-sm ${onNavy ? "text-white" : selected && !disabled ? "text-ink" : "text-faint"}`}
        >
          {selected?.label ?? placeholder ?? ""}
        </Text>
        <ChevronDown size={16} color={onNavy ? icons.onNavy : icons.muted} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={accessibilityLabel} presentation="auto" testID={`${testID}-sheet`}>
        <Box accessibilityRole="radiogroup" className="pb-1">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                testID={`${testID}-option-${option.value}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: option.disabled }}
                disabled={option.disabled}
                onPress={() => {
                  setOpen(false);
                  if (!isSelected) onChange(option.value);
                }}
                className="min-h-[52px] flex-row items-center justify-between gap-3 rounded-control px-2 data-[hover=true]:bg-neutral-wash"
              >
                <Text className={`flex-1 text-sm ${isSelected ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                  {option.label}
                </Text>
                {isSelected ? <Check size={18} color={icons.primary} /> : null}
              </Pressable>
            );
          })}
        </Box>
      </Sheet>
    </>
  );
}
