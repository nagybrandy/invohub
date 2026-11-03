// components/settings/AccentSwatches.tsx
// The invoice accent colour as a row of swatches (radiogroup) — presets plus
// whatever custom hex the owner typed, which the page offers in a field below.
// The hex values are DATA for the invoice PDF (they are stored in the
// template), not interface colours, so they live here and not in the tokens.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";

/** First entry is the app's default accent (lib/invoices/pdf-template/defaults.ts). */
export const PDF_ACCENT_PRESETS = ["#6495ed", "#3F6BC4", "#1B7A4F", "#C2410C", "#212325"] as const;

export function sameColor(a: string | undefined | null, b: string | undefined | null): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

export function AccentSwatches({
  value,
  onChange,
  accessibilityLabel,
  testID = "accent-swatches",
}: {
  value: string;
  onChange: (hex: string) => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Box testID={testID} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row flex-wrap gap-2.5">
      {PDF_ACCENT_PRESETS.map((hex) => {
        const selected = sameColor(value, hex);
        return (
          <Pressable
            key={hex}
            testID={`${testID}-${hex.slice(1).toLowerCase()}`}
            accessibilityRole="radio"
            accessibilityLabel={hex}
            accessibilityState={{ checked: selected, selected }}
            aria-checked={selected}
            onPress={() => onChange(hex)}
            className={`h-9 w-9 items-center justify-center rounded-full border-2 ${selected ? "border-ink" : "border-transparent"}`}
          >
            <Box className="h-6 w-6 rounded-full" style={{ backgroundColor: hex }} />
          </Pressable>
        );
      })}
    </Box>
  );
}
