// components/invoices/composer/DateInput.tsx
// INV-8: a real date input instead of a free-text "ÉÉÉÉ-HH-NN" field a user
// can mistype into something unparseable. Web gets the native <input
// type="date">; native keeps a text field (same pattern already used in
// app/(app)/import/index.tsx for a web-only DOM element).
import { Platform } from "react-native";
import { Input, InputField } from "@/components/ui/input";
import { MIN_TAP_TARGET_PX } from "@/lib/ui/tap-target";

export function DateInput({
  value,
  onChangeText,
  invalid,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  invalid?: boolean;
  testID?: string;
}) {
  if (Platform.OS === "web") {
    return (
      <input
        data-testid={testID}
        type="date"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        style={{
          height: MIN_TAP_TARGET_PX,
          width: "100%",
          borderRadius: 8,
          border: `1px solid ${invalid ? "#dc2626" : "var(--border)"}`,
          background: "var(--card)",
          color: "var(--foreground)",
          padding: "0 10px",
          fontSize: 14,
        }}
      />
    );
  }

  return (
    <Input data-invalid={invalid}>
      <InputField
        testID={testID}
        placeholder="ÉÉÉÉ-HH-NN"
        value={value}
        onChangeText={onChangeText}
      />
    </Input>
  );
}
