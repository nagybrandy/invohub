// components/marketing/brand-mark-svg.test.ts
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  type BrandShape,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";
import { brandMarkSvg } from "@/components/marketing/brand-mark-svg";

describe("brandMarkSvg", () => {
  const geometry = BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT];

  it("has the mark's viewBox (AC11)", () => {
    const svg = brandMarkSvg();
    expect(svg).toContain(`viewBox="0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}"`);
    expect(svg).toContain('viewBox="0 0 48 48"');
  });

  it("contains every path d and circle from the imported geometry constant (AC11/AC13)", () => {
    const svg = brandMarkSvg();
    const allShapes: BrandShape[] = [...geometry.frame, ...geometry.flow];

    for (const shape of allShapes) {
      if (shape.kind === "path") {
        expect(svg).toContain(`d="${shape.d}"`);
      } else {
        expect(svg).toContain(`cx="${shape.cx}"`);
        expect(svg).toContain(`cy="${shape.cy}"`);
      }
    }
  });

  it("uses landingColors.navy for the frame and landingColors.cornflower for the flow by default", () => {
    const svg = brandMarkSvg();
    expect(svg).toContain(landingColors.navy);
    expect(svg).toContain(landingColors.cornflower);
  });

  it("is marked as a named image for assistive tech (AC12)", () => {
    const svg = brandMarkSvg();
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="InvoHub"');
  });

  it("gives a stroked shape fill=none and a stroke-width, and a filled shape a fill with no stroke-width", () => {
    const svg = brandMarkSvg();
    const strokedShape = [...geometry.frame, ...geometry.flow].find(
      (s) => s.stroke !== undefined
    );
    expect(strokedShape).toBeDefined();
    if (strokedShape) {
      expect(svg).toContain(`stroke-width="${strokedShape.stroke}"`);
    }
    expect(svg).toContain('fill="none"');
    expect(svg).toContain(`fill="${landingColors.navy}"`);
  });

  it("respects a custom size/ink/accent", () => {
    const svg = brandMarkSvg({ size: 20, ink: "#ff0000", accent: "#00ff00" });
    expect(svg).toContain('width="20"');
    expect(svg).toContain('height="20"');
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#00ff00");
  });
});
