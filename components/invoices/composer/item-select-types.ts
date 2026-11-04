// components/invoices/composer/item-select-types.ts
// Shared by ItemSelect.tsx and ItemSelect.web.tsx (a .web file must not import
// runtime values from its native twin).
export type ItemSelectOption<T extends string = string> = {
  value: T;
  /** Full text, shown in the option list. */
  label: string;
};

export type ItemSelectProps<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<ItemSelectOption<T>>;
  accessibilityLabel: string;
  /** Short text for the closed field (web), e.g. "AAM" for "AAM — Alanyi adómentes". Defaults to the option label. */
  display?: string;
  testID?: string;
  className?: string;
};

/** Item cells are 38px high (tokens.md §6.18). */
export const ITEM_CELL_HEIGHT_PX = 38;
