// lib/theme/tokens.test.ts
import {
  iconColors,
  invoHubDesignTokens,
  themeTokens,
} from "@/lib/theme/tokens";

describe("themeTokens", () => {
  it("uses RGB triplets for background and foreground", () => {
    expect(themeTokens.light["--background"]).toBe("246 246 248");
    expect(themeTokens.dark["--background"]).toBe("9 11 16");
    expect(themeTokens.dark["--primary-foreground"]).toBe("255 255 255");
  });

  it("exposes the approved radius, spacing, and hard shadow scales", () => {
    expect(invoHubDesignTokens.radius.lg).toBe(8);
    expect(invoHubDesignTokens.radius.marketing).toBe(28);
    expect(invoHubDesignTokens.spacing).toContain(18);
    expect(invoHubDesignTokens.shadow.hard1).toContain("2px 2px");
    expect(invoHubDesignTokens.color.border200).toBe("#c5c7ca");
    expect(invoHubDesignTokens.color.navy).toBe("#111f4a");
    expect(invoHubDesignTokens.color.cornflower).toBe("#6495ed");
    expect(invoHubDesignTokens.color.success).toBe("#15803d");
    expect(invoHubDesignTokens.marketing.surfaceHero).toBe("#111f4a");
    expect(invoHubDesignTokens.typography.display.hero.desktop).toBe(48);
  });

  it("keeps green out of brand primary tokens", () => {
    expect(themeTokens.light["--primary"]).toBe("70 117 202");
    expect(themeTokens.light["--secondary"]).toBe("17 31 74");
    expect(invoHubDesignTokens.color.primary500).not.toMatch(/15803d|16a34a|22c55e/i);
  });

  it("uses Figma design system colors", () => {
    expect(themeTokens.light["--secondary"]).toBe("17 31 74");
    expect(themeTokens.light["--accent"]).toBe("217 231 255");
    expect(themeTokens.dark["--muted-foreground"]).toBe("180 190 204");
  });

  it("keeps --primary at an AA-accessible shade (primary600) for white-on-fill text", () => {
    // #4675ca on white ~= 4.5:1, passing WCAG AA for normal text/buttons.
    // The raw brand cornflower (primary500 #6495ed, ~2.98:1) must not be
    // reintroduced here — it stays available for large text/icons/outlines
    // via invoHubDesignTokens.color.primary500 instead.
    expect(themeTokens.light["--primary"]).toBe("70 117 202");
    expect(invoHubDesignTokens.color.primary600).toBe("#4675ca");
  });
});

describe("iconColors", () => {
  it("provides light and dark icon palettes", () => {
    expect(iconColors.light.primary).toMatch(/^#/);
    expect(iconColors.dark.primary).not.toBe(iconColors.light.primary);
  });
});
