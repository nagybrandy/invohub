// components/invoices/composer/DateInput.tsx
// INV-8: a real date input instead of a free-text "ÉÉÉÉ-HH-NN" field a user
// can mistype into something unparseable. Web gets the native <input
// type="date"> (42px, design tokens); native keeps a text field (same pattern
// already used in app/(app)/import/index.tsx for a web-only DOM element).
import { Platform } from "react-native";
import { INPUT_HEIGHT_PX, Input, InputField } from "@/components/ui/input";

export function DateInput({
  value,
  onChangeText,
  invalid,
  testID,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  invalid?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  if (Platform.OS === "web") {
    return (
      <input
        data-testid={testID}
        aria-label={accessibilityLabel}
        aria-invalid={invalid || undefined}
        type="date"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        style={{ height: INPUT_HEIGHT_PX }}
        className={`w-full rounded-control border bg-surface px-3 text-sm text-ink focus:border-primary focus:outline focus:outline-2 focus:outline-primary ${
          invalid ? "border-err" : "border-line-strong"
        }`}
      />
    );
  }

  return (
    <Input data-invalid={invalid}>
      <InputField
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        placeholder="ÉÉÉÉ-HH-NN"
        value={value}
        onChangeText={onChangeText}
      />
    </Input>
  );
}
