// lib/theme/tokens.test.ts
import { iconColors, themeTokens } from "@/lib/theme/tokens";

describe("themeTokens", () => {
  it("uses RGB triplets for background and foreground", () => {
    expect(themeTokens.light["--background"]).toBe("248 250 252");
    expect(themeTokens.dark["--background"]).toBe("9 11 16");
    expect(themeTokens.dark["--primary-foreground"]).toBe("255 255 255");
  });

  it("uses Figma design system colors", () => {
    expect(themeTokens.light["--primary"]).toBe("100 149 237");
    expect(themeTokens.light["--secondary"]).toBe("17 31 74");
    expect(themeTokens.light["--accent"]).toBe("141 182 0");
    expect(themeTokens.dark["--muted-foreground"]).toBe("180 190 204");
  });
});

describe("iconColors", () => {
  it("provides light and dark icon palettes", () => {
    expect(iconColors.light.primary).toMatch(/^#/);
    expect(iconColors.dark.primary).not.toBe(iconColors.light.primary);
  });
});
