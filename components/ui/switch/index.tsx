// components/ui/switch/index.tsx
// Accessible switch shared by native and web: a 40×22 track centred in a
// 44×44 touch target (the smallest target iOS/Android guidelines accept),
// with its on/off state exposed to assistive tech on both platforms.
import type { SwitchProps } from "react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";

export function Switch({
  value = false,
  disabled,
  onValueChange,
  accessibilityLabel,
  ...props
}: SwitchProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      // React Native Web doesn't derive aria-checked from accessibilityState
      // for a custom Pressable, so a screen reader on web would read the
      // switch without ever saying whether it is on. Harmless on native.
      aria-checked={value}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      className={`h-11 w-11 items-center justify-center ${disabled ? "opacity-40" : ""}`}
    >
      <Box
        className={`h-[22px] w-10 justify-center rounded-full px-0.5 data-[focus-visible=true]:web:ring-2 data-[focus-visible=true]:web:ring-primary/50 ${
          value ? "bg-primary" : "bg-[#a6a8ab]"
        }`}
      >
        <Box
          className={`h-[18px] w-[18px] rounded-full bg-white shadow-sm ${
            value ? "self-end" : "self-start"
          }`}
        />
      </Box>
    </Pressable>
  );
}
