// components/invoices/composer/ItemSelect.web.tsx
// Web: the visible field is a styled div showing the short `display` text, with
// a transparent native <select> laid over it. The browser's own picker, typeahead
// and screen-reader support come for free, and the closed field can say "AAM"
// while the list says "AAM — Alanyi adómentes". The focus ring is drawn by the
// wrapper (focus-within) because the select itself is invisible.
import * as React from "react";
import { ChevronDown } from "lucide-react-native";
import { useIconColors } from "@/lib/theme/icon-colors";
import {
  ITEM_CELL_HEIGHT_PX,
  type ItemSelectProps,
} from "@/components/invoices/composer/item-select-types";

export type { ItemSelectProps, ItemSelectOption } from "@/components/invoices/composer/item-select-types";

export function ItemSelect<T extends string = string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  display,
  testID = "item-select",
  className = "",
}: ItemSelectProps<T>) {
  const icons = useIconColors();
  const selected = options.find((option) => option.value === value);
  const shown = display ?? selected?.label ?? "";

  return (
    <div
      className={`relative w-full rounded-control border border-line-strong bg-surface focus-within:border-primary focus-within:outline focus-within:outline-2 focus-within:outline-primary ${className}`}
      style={{ height: ITEM_CELL_HEIGHT_PX }}
    >
      <div className="pointer-events-none flex h-full items-center justify-between gap-1 pl-3 pr-2 text-sm text-ink">
        <span className="min-w-0 truncate">{shown}</span>
        <ChevronDown size={14} color={icons.muted} />
      </div>
      <select
        data-testid={testID}
        aria-label={accessibilityLabel}
        value={selected ? value : ""}
        onChange={(event) => onChange(event.target.value as T)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {selected ? null : <option value="" />}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
