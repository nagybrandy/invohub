// components/marketing/BrandLogo.tsx
// InvoHub brand lockup: the brand tile carrying the SVG hub mark plus the
// Stack Sans Notch wordmark.
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
import { useIconColors } from "@/lib/theme/icon-colors";

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
  /** Show the brand tile with the SVG mark next to the wordmark. On by default. */
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

/**
 * The lockup used on every public page and the auth layout: the brand tile
 * (the sidebar's primary-blue rounded square, here carrying the white hub mark)
 * plus the "InvoHub" wordmark in Stack Sans Notch. `onDark` is for the navy
 * bands (white wordmark); `onLight` follows the page ink in both themes.
 */
export function BrandLogo({
  tone = "onDark",
  height = 32,
  mark = BRAND_MARK_DEFAULT,
  withMark = true,
  testID = "brand-logo",
}: BrandLogoProps) {
  const icons = useIconColors();
  const ink = tone === "onDark" ? "text-white" : "text-ink";
  const tile = Math.max(24, Math.round(height * 0.72));
  const fontSize = Math.max(18, Math.round(tile * 0.76));

  return (
    <HStack
      space="sm"
      className="items-center"
      testID={testID}
      accessibilityLabel="InvoHub"
    >
      {withMark ? (
        <Box
          className="items-center justify-center rounded-[7px] bg-primary"
          style={{ width: tile, height: tile }}
        >
          <BrandMark
            size={Math.round(tile * 0.7)}
            tone="onDark"
            mark={mark}
            color={icons.onNavyActive}
            accentColor={icons.onNavy}
            labelled={false}
            testID={`${testID}-mark`}
          />
        </Box>
      ) : null}
      <Text
        className={`font-heading font-bold ${ink}`}
        style={{ fontSize, lineHeight: fontSize * 1.1, letterSpacing: -0.2 }}
      >
        InvoHub
      </Text>
    </HStack>
  );
}
