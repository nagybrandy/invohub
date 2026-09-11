// components/marketing/MarketingInfographic.tsx
// Responsive marketing infographic frame with premium panel treatment.
import * as React from "react";
import { Image, type ImageSourcePropType } from "react-native";
import { Box } from "@/components/ui/box";

type MarketingInfographicProps = {
  source: ImageSourcePropType;
  alt: string;
  testID?: string;
  className?: string;
  aspectRatio?: number;
};

export function MarketingInfographic({
  source,
  alt,
  testID,
  className,
  aspectRatio = 16 / 9,
}: MarketingInfographicProps) {
  return (
    <Box
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={alt}
      className={`w-full overflow-hidden rounded-marketing border border-white/10 bg-white/5 shadow-lg ${
        className ?? ""
      }`}
    >
      <Image
        source={source}
        style={{ width: "100%", aspectRatio }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </Box>
  );
}

export const workflowInfographic = require("@/assets/marketing/invohub-infographic-workflow.jpg");
export const bentoInfographic = require("@/assets/marketing/invohub-infographic-bento.jpg");
