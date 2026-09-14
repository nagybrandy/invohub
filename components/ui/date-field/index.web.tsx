// components/ui/date-field/index.web.tsx
// Web variant: a real <input type="date"> — the platform date picker,
// keyboard-typeable ISO value, no custom calendar widget to build/maintain
// (spec §2.3). webDomProps before spreading rest props (AGENTS.md §2).
import { webDomProps } from "@/components/ui/web-dom-props";
import type { DateFieldProps } from "@/components/ui/date-field";

export type { DateFieldProps } from "@/components/ui/date-field";

export function DateField({
  value,
  onChange,
  placeholder,
  min,
  max,
  disabled,
  testID = "date-field",
  accessibilityLabel,
  className = "",
  ...rest
}: DateFieldProps) {
  return (
    <input
      type="date"
      data-testid={testID}
      aria-label={accessibilityLabel ?? placeholder}
      value={value ?? ""}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
      {...webDomProps(rest)}
    />
  );
}
