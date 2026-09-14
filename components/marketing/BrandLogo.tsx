// components/marketing/BrandLogo.tsx
// InvoHub brand lockup: the SVG hub mark plus the Ranade typography wordmark.
//
// The mark ships in two design directions (see brand-mark-geometry.ts and
// marketing/brand-directions.html). Pass `mark="angular" | "rounded"` to force
// one; by default every call site follows BRAND_MARK_DEFAULT, so the whole
// product switches direction from a single constant once the owner chooses.
import * as React from "react";
import Svg from "react-native-svg";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { BrandShapeGroup } from "@/components/marketing/BrandShapes";
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  type BrandMarkVariant,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";

export type BrandTone = "onDark" | "onLight";

type BrandMarkProps = {
  /** Rendered edge length in px. `height` is accepted as an alias. */
  size?: number;
  height?: number;
  tone?: BrandTone;
  /** Design direction. Defaults to BRAND_MARK_DEFAULT. */
  mark?: BrandMarkVariant;
  /** `duotone` accents the hub and links in cornflower; `mono` uses one ink. */
  variant?: "duotone" | "mono";
  /** Explicit override for the frame ink (defaults from `tone`). */
  color?: string;
  /** Explicit override for the hub/link accent (defaults from `tone`/`variant`). */
  accentColor?: string;
  /** Decorative instances should pass `false` so screen readers skip them. */
  labelled?: boolean;
  testID?: string;
};

type BrandLogoProps = {
  tone?: BrandTone;
  height?: number;
  /** Kept for API compatibility with existing section imports. */
  variant?: "composed" | "lockup";
  /** Design direction for the paired mark. */
  mark?: BrandMarkVariant;
  /** Pair the wordmark with the SVG mark. Off by default so chrome stays calm. */
  withMark?: boolean;
  testID?: string;
};

/** Frame ink / accent ink for each surface. */
function resolveMarkColors(
  tone: BrandTone,
  variant: "duotone" | "mono",
  color?: string,
  accentColor?: string
) {
  const ink = color ?? (tone === "onDark" ? landingColors.white : landingColors.navy);
  if (variant === "mono") {
    return { ink, accent: accentColor ?? ink };
  }
  return { ink, accent: accentColor ?? landingColors.cornflower };
}

/**
 * The InvoHub mark: two open corner brackets (a ledger page whose 45° corners
 * are gateways), a hub at the centre, and two links running out through the
 * gates. Renders through react-native-svg so it is identical on web and native.
 */
export function BrandMark({
  size,
  height,
  tone = "onDark",
  mark = BRAND_MARK_DEFAULT,
  variant = "duotone",
  color,
  accentColor,
  labelled = true,
  testID = "brand-mark",
}: BrandMarkProps) {
  const edge = Math.max(12, Math.round(size ?? height ?? 36));
  const { ink, accent } = resolveMarkColors(tone, variant, color, accentColor);
  const geometry = BRAND_MARK_GEOMETRY[mark];

  return (
    <Box
      testID={testID}
      accessibilityRole={labelled ? "image" : undefined}
      accessibilityLabel={labelled ? "InvoHub" : undefined}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? "yes" : "no-hide-descendants"}
    >
      <Svg
        width={edge}
        height={edge}
        fill="none"
        viewBox={`0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}`}
      >
        <BrandShapeGroup
          shapes={geometry.frame}
          color={ink}
          rounded={geometry.rounded}
        />
        <BrandShapeGroup
          shapes={geometry.flow}
          color={accent}
          rounded={geometry.rounded}
        />
      </Svg>
    </Box>
  );
}

export function BrandLogo({
  tone = "onDark",
  height = 32,
  mark = BRAND_MARK_DEFAULT,
  withMark = false,
  testID = "brand-logo",
}: BrandLogoProps) {
  const ink = tone === "onDark" ? "text-white" : "text-secondary";
  const accent = "text-primary";
  const fontSize = Math.max(18, Math.round(height * 0.72));

  const wordmark = (
    <HStack className="items-baseline">
      <Text
        className={`font-heading font-bold tracking-tight ${ink}`}
        style={{ fontSize, lineHeight: fontSize * 1.08, letterSpacing: -0.35 }}
      >
        Invo
      </Text>
      <Text
        className={`font-heading font-bold tracking-tight ${accent}`}
        style={{ fontSize, lineHeight: fontSize * 1.08, letterSpacing: -0.35 }}
      >
        Hub
      </Text>
    </HStack>
  );

  if (!withMark) {
    return (
      <HStack className="items-baseline" testID={testID} accessibilityLabel="InvoHub">
        {wordmark}
      </HStack>
    );
  }

  return (
    <HStack
      space="sm"
      className="items-center"
      testID={testID}
      accessibilityLabel="InvoHub"
    >
      <BrandMark
        size={Math.round(height * 0.86)}
        tone={tone}
        mark={mark}
        labelled={false}
        testID={`${testID}-mark`}
      />
      {wordmark}
    </HStack>
  );
}
