// components/marketing/BrandTexture.tsx
// Decorative brand-mark background layer for marketing surfaces.
//
// Two modes, both derived from the same geometry as the BrandLogo mark:
//   tile — the 96x96 texture tile repeated across the whole surface;
//   mark — one oversized mark sitting at an angle, like a watermark.
//
// Follows the same `mark` design direction as BrandLogo (see
// brand-mark-geometry.ts), so the whole system switches from one constant.
//
// Always absolutely positioned, always inert: it never intercepts touches or
// clicks, never announces itself to screen readers, and never affects the
// layout of its siblings. It is deliberately static — no animation, so there is
// nothing for reduced-motion users to opt out of — and it is capped at a very
// low opacity so it can never reduce text contrast on the content above it.
import * as React from "react";
import Svg, { Defs, G, Pattern, Rect } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { BrandShapeGroup } from "@/components/marketing/BrandShapes";
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  BRAND_TILE_GEOMETRY,
  BRAND_TILE_VIEWBOX,
  type BrandMarkVariant,
} from "@/components/marketing/brand-mark-geometry";
import { type BrandTone } from "@/components/marketing/BrandLogo";
import { landingColors } from "@/components/marketing/landing-theme";

/** Decoration must never approach text-contrast territory. */
const MAX_OPACITY = 0.14;

type BrandTextureProps = {
  tone?: BrandTone;
  variant?: "tile" | "mark";
  /** Design direction. Defaults to BRAND_MARK_DEFAULT. */
  mark?: BrandMarkVariant;
  /** Explicit ink override; defaults to white on dark, navy on light. */
  color?: string;
  /** 0–0.14. Defaults to 0.07 (tile) / 0.06 (mark). */
  opacity?: number;
  /** Edge length of one texture repeat, in px. `tile` variant only. */
  tile?: number;
  /** Edge length of the single mark, in px. `mark` variant only. */
  size?: number;
  /** Degrees. Rotates the repeat, or the single mark. */
  rotate?: number;
  /** Positioning overrides for the absolute layer (it defaults to inset-0). */
  className?: string;
  testID?: string;
};

function clampOpacity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_OPACITY, value);
}

export function BrandTexture({
  tone = "onDark",
  variant = "tile",
  mark = BRAND_MARK_DEFAULT,
  color,
  opacity,
  tile = 132,
  size = 360,
  rotate = 0,
  className = "inset-0",
  testID = "brand-texture",
}: BrandTextureProps) {
  const rawId = React.useId();
  const patternId = `ih-texture-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ink = color ?? (tone === "onDark" ? landingColors.white : landingColors.navy);
  const alpha = clampOpacity(opacity ?? (variant === "mark" ? 0.06 : 0.07));

  if (alpha === 0) return null;

  const markGeometry = BRAND_MARK_GEOMETRY[mark];
  const tileGeometry = BRAND_TILE_GEOMETRY[mark];

  return (
    <Box
      testID={testID}
      className={`pointer-events-none absolute overflow-hidden ${className}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {variant === "mark" ? (
        <Svg
          width={size}
          height={size}
          fill="none"
          opacity={alpha}
          viewBox={`-10 -10 ${BRAND_MARK_VIEWBOX + 20} ${BRAND_MARK_VIEWBOX + 20}`}
        >
          {/* Explicit SVG transform instead of rotation+originX/originY: on web
              react-native-svg turns the origin props into a `transform-origin`
              DOM attribute, which React DOM rejects ("Invalid DOM property") and
              Expo's dev overlay then covers the bottom of the screen. */}
          <G transform={`rotate(${rotate} ${BRAND_MARK_VIEWBOX / 2} ${BRAND_MARK_VIEWBOX / 2})`}>
            <BrandShapeGroup
              shapes={[...markGeometry.frame, ...markGeometry.flow]}
              color={ink}
              rounded={markGeometry.rounded}
            />
          </G>
        </Svg>
      ) : (
        <Svg width="100%" height="100%" opacity={alpha}>
          <Defs>
            <Pattern
              id={patternId}
              x={0}
              y={0}
              width={tile}
              height={tile}
              patternUnits="userSpaceOnUse"
              viewBox={`0 0 ${BRAND_TILE_VIEWBOX} ${BRAND_TILE_VIEWBOX}`}
              patternTransform={rotate ? `rotate(${rotate})` : undefined}
            >
              <BrandShapeGroup
                shapes={tileGeometry.shapes}
                color={ink}
                rounded={tileGeometry.rounded}
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />
        </Svg>
      )}
    </Box>
  );
}
