// components/ui/date-field/index.tsx
// Cross-platform date field — the composer's issue/due/fulfillment dates
// (spec §2.3). Native: today's plain text field, ISO "YYYY-MM-DD" value,
// no native masking library in this repo yet. See index.web.tsx for the
// web variant, which renders a real <input type="date">.
import { Input, InputField } from "@/components/ui/input";

export type DateFieldProps = {
  /** ISO date string "YYYY-MM-DD", or "" / undefined for empty. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
};

export function DateField({
  value,
  onChange,
  placeholder = "ÉÉÉÉ-HH-NN",
  disabled,
  testID = "date-field",
  accessibilityLabel,
  className,
}: DateFieldProps) {
  return (
    <Input
      testID={testID}
      isDisabled={disabled}
      className={className}
    >
      <InputField
        value={value ?? ""}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        editable={!disabled}
      />
    </Input>
  );
}
