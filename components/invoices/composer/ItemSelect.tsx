// components/invoices/composer/ItemSelect.tsx
// The 38px select of a line-item cell (tokens.md §6.18: item cells are 38px,
// the foundation Select is the 42px form field). Native: the foundation Select
// (option sheet). Web: ItemSelect.web.tsx, a real <select>.
import * as React from "react";
import { Select } from "@/components/ui/select";
import type { ItemSelectProps } from "@/components/invoices/composer/item-select-types";

export type { ItemSelectProps, ItemSelectOption } from "@/components/invoices/composer/item-select-types";

export function ItemSelect<T extends string = string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  testID,
  className,
}: ItemSelectProps<T>) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={className}
    />
  );
}
