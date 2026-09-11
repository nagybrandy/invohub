// components/marketing/BrandLogo.tsx
// Typography-first InvoHub wordmark for marketing and app chrome (no mark glyph for now).
import * as React from "react";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

type BrandTone = "onDark" | "onLight";

type BrandMarkProps = {
  size?: number;
  tone?: BrandTone;
  testID?: string;
};

type BrandLogoProps = {
  tone?: BrandTone;
  height?: number;
  /** Kept for API compatibility; the lockup is typography-only. */
  variant?: "composed" | "lockup";
  testID?: string;
};

/**
 * Letterform stand-in while the mark is redesigned. Renders a compact "IH"
 * wordmark so existing BrandMark call sites keep working.
 */
export function BrandMark({
  size = 36,
  tone = "onDark",
  testID = "brand-mark",
}: BrandMarkProps) {
  const colorClass = tone === "onDark" ? "text-white" : "text-secondary";
  const fontSize = Math.max(14, Math.round(size * 0.55));

  return (
    <Text
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="InvoHub"
      className={`font-heading font-bold tracking-tight ${colorClass}`}
      style={{ fontSize, lineHeight: fontSize * 1.1 }}
    >
      IH
    </Text>
  );
}

export function BrandLogo({
  tone = "onDark",
  height = 32,
  testID = "brand-logo",
}: BrandLogoProps) {
  const ink = tone === "onDark" ? "text-white" : "text-secondary";
  const accent = tone === "onDark" ? "text-primary" : "text-primary";
  const fontSize = Math.max(18, Math.round(height * 0.72));

  return (
    <HStack className="items-baseline" testID={testID} accessibilityLabel="InvoHub">
      <Text
        className={`font-heading font-bold tracking-tight ${ink}`}
        style={{ fontSize, lineHeight: fontSize * 1.05, letterSpacing: -0.6 }}
      >
        Invo
      </Text>
      <Text
        className={`font-heading font-bold tracking-tight ${accent}`}
        style={{ fontSize, lineHeight: fontSize * 1.05, letterSpacing: -0.6 }}
      >
        Hub
      </Text>
    </HStack>
  );
}
