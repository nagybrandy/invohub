// components/ui/select/index.web.tsx
// Web select: a real <select> (native picker, typeahead, a11y for free) styled
// to the design: 42px, 8px radius, line-strong border, chevron at the right.
import * as React from "react";
import { ChevronDown } from "lucide-react-native";
import { useIconColors } from "@/lib/theme/icon-colors";
import { SELECT_HEIGHT_PX, type SelectProps } from "@/components/ui/select/types";

export type { SelectOption, SelectProps } from "@/components/ui/select/types";
export { SELECT_HEIGHT_PX } from "@/components/ui/select/types";

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  invalid = false,
  accessibilityLabel,
  testID = "select",
  className = "",
  tone = "default",
}: SelectProps<T>) {
  const icons = useIconColors();
  const hasValue = options.some((option) => option.value === value);
  const onNavy = tone === "onNavy";

  return (
    <div className={`relative w-full ${className}`}>
      <select
        data-testid={testID}
        aria-label={accessibilityLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={hasValue ? (value as string) : ""}
        onChange={(event) => onChange(event.target.value as T)}
        style={{ height: SELECT_HEIGHT_PX }}
        className={`w-full cursor-pointer appearance-none rounded-control border pl-3 pr-9 text-sm disabled:cursor-not-allowed ${
          onNavy
            ? "border-white/[0.22] bg-transparent text-white"
            : `bg-surface disabled:bg-wash2 disabled:text-faint ${invalid ? "border-err" : "border-line-strong"} ${
                hasValue ? "text-ink" : "text-faint"
              }`
        }`}
      >
        {!hasValue ? (
          <option value="" disabled>
            {placeholder ?? ""}
          </option>
        ) : null}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="bg-surface text-ink"
          >
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2">
        <ChevronDown size={16} color={onNavy ? icons.onNavy : icons.muted} />
      </span>
    </div>
  );
}
