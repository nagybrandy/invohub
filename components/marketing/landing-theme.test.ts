// components/marketing/landing-theme.test.ts
// Guards the brand palette used by the invoice PDF and the public-page layout presets.
import {
  LANDING_DESKTOP_MIN,
  LANDING_TABLET_MIN,
  landingColors,
  landingColumns,
  landingDisplayType,
  landingLayout,
  landingRadii,
  landingType,
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

  it("uses the design radii: 12 cards, 16 for the navy call-to-action card", () => {
    expect(landingRadii.card).toBe(12);
    expect(landingRadii.panel).toBe(16);
    expect(landingRadii.control).toBe(8);
  });

  it("defines a 1160px container with 16/24px gutters", () => {
    expect(landingLayout.container).toContain("max-w-[1160px]");
    expect(landingLayout.container).toContain("px-4");
    expect(landingLayout.container).toContain("tab:px-6");
  });

  it("sets hero and section type per the spec (48/32 hero, 32/24 h2) with theme tokens only", () => {
    expect(landingType.heroTitle).toContain("text-[48px]");
    expect(landingType.heroTitle).toContain("phone:text-[32px]");
    expect(landingType.h2).toContain("text-[32px]");
    expect(landingType.h2).toContain("phone:text-2xl");
    expect(landingDisplayType.kicker).toContain("tracking");
    for (const classes of Object.values(landingType)) {
      expect(classes).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("maps window width to 3 / 2 / 1 card columns", () => {
    expect(landingColumns(1440)).toBe(3);
    expect(landingColumns(LANDING_DESKTOP_MIN)).toBe(3);
    expect(landingColumns(LANDING_DESKTOP_MIN - 1)).toBe(2);
    expect(landingColumns(768)).toBe(2);
    expect(landingColumns(LANDING_TABLET_MIN)).toBe(2);
    expect(landingColumns(LANDING_TABLET_MIN - 1)).toBe(1);
    expect(landingColumns(375)).toBe(1);
    expect(landingColumns(0)).toBe(1);
  });
});
