// lib/theme/contrast.test.ts
import { contrastRatio, relativeLuminance, WCAG_AA_NORMAL_TEXT } from "@/lib/theme/contrast";

describe("relativeLuminance", () => {
  it("is 1 for white and 0 for black", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white (within 1e-9)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 9);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 9);
  });

  it("returns 1 for a colour against itself", () => {
    expect(contrastRatio("#5b6178", "#5b6178")).toBeCloseTo(1, 9);
  });

  it("is symmetric in its two arguments", () => {
    expect(contrastRatio("#8a90a6", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#8a90a6"),
      9
    );
    expect(contrastRatio("#111f4a", "#d9e7ff")).toBeCloseTo(
      contrastRatio("#d9e7ff", "#111f4a"),
      9
    );
  });

  it("matches the known WCAG value for #8a90a6 on white (~3.17:1)", () => {
    expect(contrastRatio("#8a90a6", "#ffffff")).toBeCloseTo(3.17, 2);
  });
});

describe("WCAG_AA_NORMAL_TEXT", () => {
  it("is the WCAG AA normal-text contrast floor, 4.5", () => {
    expect(WCAG_AA_NORMAL_TEXT).toBe(4.5);
  });
});
