// components/ui/choice-pill/index.tsx
// Shared tap-target-safe choice control for the invoice flow — VAT category,
// payment method, currency, deadline quick-pick, and invoice-list filter
// chips all render through this instead of copying a Pressable + className.
//
// Deliberate departure from AGENTS.md §5's tva() convention: tva() runs
// twMerge, which would let a caller's conflicting className (e.g.
// "py-0.5 min-h-0") silently strip the 44px floor this component exists to
// guarantee (Apple HIG 44pt / WCAG 2.5.8 AAA). Composition here is a plain
// template literal, ordered base -> selected/unselected tokens -> caller
// className -> TAP_TARGET_MIN_H, so the floor is always composed last and
// always wins. Do not "fix" this back to tva()/twMerge.
import * as React from "react";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

export type ChoicePillProps = {
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: "radio" | "tab" | "button";
  testID?: string;
  /** Extra layout classes from the caller (width, rounding, flex). */
  className?: string;
};

const BASE = "flex-row items-center justify-center rounded-lg border px-3 py-2";
const SELECTED_TOKENS = "border-primary bg-primary/10";
const UNSELECTED_TOKENS = "border-border bg-background";

export function ChoicePill({
  selected = false,
  onPress,
  disabled = false,
  children,
  accessibilityLabel,
  accessibilityRole = "radio",
  testID,
  className = "",
}: ChoicePillProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={`${BASE} ${selected ? SELECTED_TOKENS : UNSELECTED_TOKENS} ${className} ${
        disabled ? "opacity-50" : ""
      } ${TAP_TARGET_MIN_H}`}
    >
      {children}
    </Pressable>
  );
}

export function ChoicePillGroup({
  children,
  accessibilityLabel,
  className = "",
}: {
  children: React.ReactNode;
  accessibilityLabel?: string;
  className?: string;
}) {
  return (
    <HStack
      space="sm"
      className={`flex-wrap ${className}`}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </HStack>
  );
}
