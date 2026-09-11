// components/marketing/landing-theme.test.ts
// Guards brand palette and marketing surface tokens against regressions.
import {
  landingColors,
  landingDisplayType,
  landingRadii,
  landingSurfaces,
} from "@/components/marketing/landing-theme";

describe("landing-theme", () => {
  it("exposes navy and cornflower brand colors without green primary", () => {
    expect(landingColors.navy).toBe("#111f4a");
    expect(landingColors.depth).toBe("#1f305e");
    expect(landingColors.cornflower).toBe("#6495ed");
    expect(landingColors.success).toBe("#15803d");
    expect(Object.values(landingColors)).toContain(landingColors.success);
    expect(landingColors.navy.toLowerCase()).not.toMatch(/15803d|22c55e/);
  });

  it("defines marketing surfaces, radii, and display type scale", () => {
    expect(landingSurfaces.hero).toBe(landingColors.navy);
    expect(landingRadii.panel).toBe(28);
    expect(landingDisplayType.heroDesktop).toBe("text-5xl");
    expect(landingDisplayType.kicker).toContain("tracking");
  });
});
