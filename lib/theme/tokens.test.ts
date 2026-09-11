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
    expect(invoHubDesignTokens.spacing).toContain(18);
    expect(invoHubDesignTokens.shadow.hard1).toContain("2px 2px");
    expect(invoHubDesignTokens.color.border200).toBe("#c5c7ca");
  });

  it("uses Figma design system colors", () => {
    expect(themeTokens.light["--primary"]).toBe("100 149 237");
    expect(themeTokens.light["--secondary"]).toBe("17 31 74");
    expect(themeTokens.light["--accent"]).toBe("217 231 255");
    expect(themeTokens.dark["--muted-foreground"]).toBe("180 190 204");
  });
});

describe("iconColors", () => {
  it("provides light and dark icon palettes", () => {
    expect(iconColors.light.primary).toMatch(/^#/);
    expect(iconColors.dark.primary).not.toBe(iconColors.light.primary);
  });
});
