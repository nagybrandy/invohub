// components/ui/select/types.ts
export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SelectProps<T extends string = string> = {
  value: T | "" | null | undefined;
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  /** Shown while no option is selected. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Required: a select has no visible label of its own. */
  accessibilityLabel: string;
  testID?: string;
  className?: string;
  /** `onNavy`: transparent field with white text and a white/22 border (auth panel, landing hero). */
  tone?: "default" | "onNavy";
};

/** Field height, tokens.md §6.3. */
export const SELECT_HEIGHT_PX = 42;
