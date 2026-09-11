// components/ui/switch/index.tsx
// Accessible 40×22 customized Gluestack switch shared by native and web.
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
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      className={`h-[22px] w-10 justify-center rounded-full px-0.5 data-[focus-visible=true]:web:ring-2 data-[focus-visible=true]:web:ring-primary/50 ${
        value ? "bg-primary" : "bg-[#a6a8ab]"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Box
        className={`h-[18px] w-[18px] rounded-full bg-white shadow-sm ${
          value ? "self-end" : "self-start"
        }`}
      />
    </Pressable>
  );
}
