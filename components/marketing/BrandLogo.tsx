// components/marketing/BrandLogo.tsx
// Reusable InvoHub brand mark and wordmark lockup for marketing and chrome surfaces.
import * as React from "react";
import { Image } from "react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

const logoMark = require("@/assets/brand/invohub-logo-mark.png");
const logoLockup = require("@/assets/brand/invohub-logo-lockup.png");

type BrandTone = "onDark" | "onLight";

type BrandMarkProps = {
  size?: number;
  testID?: string;
};

type BrandLogoProps = {
  tone?: BrandTone;
  height?: number;
  /** Prefer the full lockup artwork on light surfaces; otherwise compose mark + wordmark. */
  variant?: "composed" | "lockup";
  testID?: string;
};

export function BrandMark({ size = 36, testID = "brand-mark" }: BrandMarkProps) {
  return (
    <Box
      testID={testID}
      className="overflow-hidden rounded-lg"
      accessibilityRole="image"
      accessibilityLabel="InvoHub"
    >
      <Image
        source={logoMark}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Box>
  );
}

export function BrandLogo({
  tone = "onDark",
  height = 32,
  variant = "composed",
  testID = "brand-logo",
}: BrandLogoProps) {
  if (variant === "lockup") {
    const width = Math.round(height * (800 / 450));
    return (
      <Box testID={testID} accessibilityRole="image" accessibilityLabel="InvoHub">
        <Image
          source={logoLockup}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Box>
    );
  }

  return (
    <HStack space="sm" className="items-center" testID={testID}>
      <BrandMark size={height} testID="brand-mark" />
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
