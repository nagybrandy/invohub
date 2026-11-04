// components/settings/OptionSelect.tsx
// An optional choice as a dropdown: the first row ("Nincs megadva") clears the
// value, exactly like pressing a selected OptionChips chip again did. Values
// may be strings or numbers (the VAT-rate default is a number).
import * as React from "react";
import { Select } from "@/components/ui/select";

export type OptionSelectOption<T extends string | number> = { value: T; label: string };

export function OptionSelect<T extends string | number>({
  options,
  value,
  onChange,
  emptyLabel,
  accessibilityLabel,
  testID,
}: {
  options: readonly OptionSelectOption<T>[];
  value: T | undefined | null;
  onChange: (value: T | undefined) => void;
  /** Label of the "no value" row. */
  emptyLabel: string;
  accessibilityLabel: string;
  testID: string;
}) {
  const byKey = React.useMemo(() => new Map(options.map((option) => [String(option.value), option.value])), [options]);
  return (
    <Select<string>
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={value == null ? "" : String(value)}
      options={[{ value: "", label: emptyLabel }, ...options.map((option) => ({ value: String(option.value), label: option.label }))]}
      onChange={(next) => onChange(next === "" ? undefined : byKey.get(next))}
    />
  );
}
