// components/marketing/BrandShapes.tsx
// Renders BrandShape geometry through react-native-svg, so the mark and the
// texture draw identically on web and native and neither component has to
// branch on the design direction.
import * as React from "react";
import { Circle, G, Path, type Linecap, type Linejoin } from "react-native-svg";
import { type BrandShape } from "@/components/marketing/brand-mark-geometry";

export function BrandShapeGroup({
  shapes,
  color,
  rounded,
}: {
  shapes: readonly BrandShape[];
  color: string;
  rounded: boolean;
}) {
  const defaultCap: Linecap = rounded ? "round" : "butt";
  const join: Linejoin = rounded ? "round" : "miter";

  return (
    <G>
      {shapes.map((shape) => {
        const stroked = shape.stroke !== undefined;
        const paint = stroked
          ? { fill: "none" as const, stroke: color, strokeWidth: shape.stroke }
          : { fill: color, stroke: "none" as const };
        const cap: Linecap =
          shape.kind === "path" && shape.cap ? shape.cap : defaultCap;
        const joins = stroked
          ? { strokeLinecap: cap, strokeLinejoin: join }
          : {};

        if (shape.kind === "circle") {
          return (
            <Circle
              key={`c-${shape.cx}-${shape.cy}-${shape.r}`}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              {...paint}
              {...joins}
            />
          );
        }

        return <Path key={shape.d} d={shape.d} {...paint} {...joins} />;
      })}
    </G>
  );
}
