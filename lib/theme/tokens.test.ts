// lib/theme/tokens.test.ts
import { contrastRatio } from "@/lib/theme/contrast";
import {
  designHexVars,
  designPalette,
  hexToRgbTriplet,
  iconColors,
  invoHubDesignTokens,
  themeTokens,
} from "@/lib/theme/tokens";

describe("hexToRgbTriplet", () => {
  it("converts hex to a space separated triplet", () => {
    expect(hexToRgbTriplet("#3F6BC4")).toBe("63 107 196");
    expect(hexToRgbTriplet("#fff")).toBe("255 255 255");
  });
});

describe("themeTokens", () => {
  it("keeps the Gluestack names as RGB triplets driven by the design palette (SPEC 1.1)", () => {
    expect(themeTokens.light["--background"]).toBe("246 246 248");
    expect(themeTokens.dark["--background"]).toBe("10 13 18");
    expect(themeTokens.light["--card"]).toBe("255 255 255");
    expect(themeTokens.dark["--card"]).toBe("23 26 32");
    expect(themeTokens.light["--foreground"]).toBe("33 35 37");
    expect(themeTokens.light["--muted-foreground"]).toBe("91 93 97");
    expect(themeTokens.light["--muted"]).toBe("238 240 244");
    expect(themeTokens.light["--border"]).toBe("197 199 202");
    expect(themeTokens.light["--border-subtle"]).toBe("230 232 236");
    expect(themeTokens.light["--primary"]).toBe("63 107 196");
    expect(themeTokens.light["--ring"]).toBe("63 107 196");
    expect(themeTokens.light["--secondary"]).toBe("19 31 74");
    expect(themeTokens.light["--secondary-foreground"]).toBe("201 211 240");
    expect(themeTokens.light["--accent"]).toBe("230 238 252");
    expect(themeTokens.light["--accent-foreground"]).toBe("31 48 94");
    expect(themeTokens.light["--destructive"]).toBe("198 40 40");
    expect(themeTokens.dark["--primary-foreground"]).toBe("255 255 255");
    expect(themeTokens.dark["--destructive-foreground"]).toBe("255 255 255");
  });

  it("adds an -rgb twin of every design token", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const [name, hex] of Object.entries(designPalette[scheme])) {
        expect(themeTokens[scheme][`--${name}-rgb`]).toBe(hexToRgbTriplet(hex));
      }
    }
    expect(themeTokens.light["--ok-rgb"]).toBe("27 122 79");
  });

  it("exposes the design tokens as hex, minus the primary/muted name collisions", () => {
    const vars = designHexVars("light");
    expect(vars["--canvas"]).toBe("#F6F6F8");
    expect(vars["--navy"]).toBe("#131F4A");
    expect(vars["--primary"]).toBeUndefined();
    expect(vars["--muted"]).toBeUndefined();
    expect(designHexVars("dark")["--canvas"]).toBe("#0A0D12");
  });

  it("navy and its ink are the same in both themes where the design does not override them", () => {
    expect(designPalette.light["navy-ink"]).toBe(designPalette.dark["navy-ink"]);
  });

  it("matches the measured contrast table in tokens.md", () => {
    const l = designPalette.light;
    const d = designPalette.dark;
    expect(contrastRatio("#FFFFFF", l.primary)).toBeGreaterThan(5);
    // Known gap (SPEC 15.1): white on the dark primary is below AA for 14px.
    expect(contrastRatio("#FFFFFF", d.primary)).toBeCloseTo(3.58, 1);
    expect(contrastRatio(l.muted, l.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l.err, l["err-wash"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l.ok, l["ok-wash"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l.warn, l["warn-wash"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l["primary-ink"], l["primary-wash"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l["navy-ink"], l.navy)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(l["seg-active-ink"], l["seg-active"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(d.primary, d.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("invoHubDesignTokens", () => {
  it("exposes the design radii", () => {
    expect(invoHubDesignTokens.radius.control).toBe(8);
    expect(invoHubDesignTokens.radius.card).toBe(12);
    expect(invoHubDesignTokens.radius.dialog).toBe(16);
    expect(invoHubDesignTokens.radius.sheet).toBe(18);
    expect(invoHubDesignTokens.radius.pill).toBe(6);
  });

  it("names the real Stack Sans families", () => {
    expect(invoHubDesignTokens.typography.body).toContain("Stack Sans Text");
    expect(invoHubDesignTokens.typography.heading).toContain("Stack Sans Notch");
    expect(JSON.stringify(invoHubDesignTokens)).not.toMatch(/ranade/i);
  });
});

describe("iconColors", () => {
  it("is re-derived from the palette (SPEC 1.1)", () => {
    expect(iconColors.light.primary).toBe("#3F6BC4");
    expect(iconColors.light.muted).toBe("#5B5D61");
    expect(iconColors.light.foreground).toBe("#212325");
    expect(iconColors.light.destructive).toBe("#C62828");
    expect(iconColors.light.ok).toBe("#1B7A4F");
    expect(iconColors.light.warn).toBe("#8A5200");
    expect(iconColors.light.accentForeground).toBe("#1F305E");
    expect(iconColors.light.secondary).toBe("#131F4A");
    expect(iconColors.light.onNavy).toBe("#C9D3F0");
    expect(iconColors.light.onNavyActive).toBe("#FFFFFF");
    expect(iconColors.dark.primary).toBe("#5A85E0");
    expect(iconColors.dark.destructive).toBe("#F26B6B");
  });
});
