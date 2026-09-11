// components/marketing/BrandLogo.tsx
// Vector InvoHub brand mark and wordmark lockup for marketing and app chrome.
import * as React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

const NAVY = "#111f4a";
const FOLD = "#a8c4f4";
const ACCENT = "#6495ed";
const WHITE = "#ffffff";

type BrandTone = "onDark" | "onLight";

type BrandMarkProps = {
  size?: number;
  tone?: BrandTone;
  testID?: string;
};

type BrandLogoProps = {
  tone?: BrandTone;
  height?: number;
  /** Kept for API compatibility; both variants now render the vector mark. */
  variant?: "composed" | "lockup";
  testID?: string;
};

/**
 * On light surfaces the mark sits inside a navy tile. On dark surfaces the tile
 * is dropped so the glyph keeps full contrast without a heavy block of colour.
 */
export function BrandMark({
  size = 36,
  tone = "onDark",
  testID = "brand-mark",
}: BrandMarkProps) {
  const onDark = tone === "onDark";

  return (
    <Box testID={testID} accessibilityRole="image" accessibilityLabel="InvoHub">
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {onDark ? (
          <>
            <Path
              d="M9 4h14l8 8v22a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
              fill={WHITE}
            />
            <Path d="M23 4l8 8h-6a2 2 0 0 1-2-2V4Z" fill={FOLD} />
            <Rect x={13} y={23} width={3.5} height={6} rx={1.75} fill={ACCENT} />
            <Rect x={18.25} y={20} width={3.5} height={9} rx={1.75} fill={ACCENT} />
            <Rect x={23.5} y={17} width={3.5} height={12} rx={1.75} fill={ACCENT} />
          </>
        ) : (
          <>
            <Rect width={40} height={40} rx={11} fill={NAVY} />
            <Path
              d="M13 9h10l6 6v14a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z"
              fill={WHITE}
            />
            <Path d="M23 9l6 6h-4a2 2 0 0 1-2-2V9Z" fill={FOLD} />
            <Rect x={14.5} y={21} width={3} height={5} rx={1.5} fill={ACCENT} />
            <Rect x={19} y={19} width={3} height={7} rx={1.5} fill={ACCENT} />
            <Rect x={23.5} y={17} width={3} height={9} rx={1.5} fill={ACCENT} />
          </>
        )}
      </Svg>
    </Box>
  );
}

export function BrandLogo({
  tone = "onDark",
  height = 32,
  testID = "brand-logo",
}: BrandLogoProps) {
  return (
    <HStack space="sm" className="items-center" testID={testID}>
      <BrandMark size={height} tone={tone} testID="brand-mark" />
      <Text
        className={`text-lg font-bold tracking-tight ${
          tone === "onDark" ? "text-white" : "text-secondary"
        }`}
      >
        InvoHub
      </Text>
    </HStack>
  );
}
