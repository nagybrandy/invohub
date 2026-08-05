// components/ui/switch/index.tsx
import { Switch as RNSwitch, type SwitchProps } from "react-native";
import { cssInterop } from "nativewind";

const StyledSwitch = cssInterop(RNSwitch, {
  className: "style",
});

export function Switch(props: SwitchProps) {
  return (
    <StyledSwitch
      trackColor={{ false: "#e2e8f0", true: "#6495ed" }}
      thumbColor="#ffffff"
      {...props}
    />
  );
}
