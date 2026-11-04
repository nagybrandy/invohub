// lib/invoices/paper/brand-color.test.ts
import { contrastOnWhite, darkOf, inkOf, mixWithWhite, paperPalette } from "@/lib/invoices/paper/brand-color";

describe("darkOf (Dóri's --bd: darken until 4.5:1 on white)", () => {
  // Vectors measured from the prototype itself (docs/design/invoice-paper-2026-11/paper-css.md §3).
  it.each([
    ["#3F6BC4", "#3f6bc4"],
    ["#16803C", "#16803c"],
    ["#E8590C", "#cb4e0a"],
    ["#212325", "#212325"],
    ["#F2B705", "#8e6b03"],
    ["#FFFFFF", "#757575"],
    ["#00C2FF", "#007ca3"],
    ["#E91E63", "#e6175d"],
  ])("%s -> %s", (chosen, expected) => {
    expect(darkOf(chosen)).toBe(expected);
  });

  it("is always at least 4.5:1 on white, for 300 pseudo-random colours", () => {
    let seed = 20261103;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed;
    };
    for (let i = 0; i < 300; i += 1) {
      const hex = `#${(next() & 0xffffff).toString(16).padStart(6, "0")}`;
      const ink = darkOf(hex);
      expect([hex, ink, contrastOnWhite(ink) >= 4.5]).toEqual([hex, ink, true]);
    }
  });

  it("keeps the hue of a colour it darkens (still the same family)", () => {
    // orange stays orange: red channel dominant
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(darkOf("#E8590C").slice(i, i + 2), 16));
    expect(r!).toBeGreaterThan(g!);
    expect(g!).toBeGreaterThan(b!);
  });

  it("returns lowercase #rrggbb even for an already-dark colour", () => {
    expect(darkOf("#3F6BC4")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("contrastOnWhite", () => {
  it("is 21 for black and 1 for white", () => {
    expect(contrastOnWhite("#000000")).toBeCloseTo(21, 1);
    expect(contrastOnWhite("#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("mixWithWhite (--tint = brand at 12 % over white)", () => {
  it("mixes the ORIGINAL colour, not the darkened one", () => {
    // 12 % of #E8590C over white
    expect(mixWithWhite("#E8590C", 0.12)).toBe("#fcebe2");
  });
  it("0 is white and 1 is the colour", () => {
    expect(mixWithWhite("#3F6BC4", 0)).toBe("#ffffff");
    expect(mixWithWhite("#3F6BC4", 1)).toBe("#3f6bc4");
  });
});

describe("paperPalette / inkOf", () => {
  it("derives ink, tint and the frame border from the chosen colour", () => {
    const palette = paperPalette("#E8590C");
    expect(palette.ink).toBe("#cb4e0a");
    expect(palette.tint).toBe(mixWithWhite("#E8590C", 0.12));
    expect(palette.frameBorder).toBe(mixWithWhite("#cb4e0a", 0.35));
    expect(inkOf("#E8590C")).toBe("#cb4e0a");
  });

  it("falls back to Dóri's blue for a malformed colour", () => {
    expect(paperPalette("red; } body").ink).toBe("#3f6bc4");
  });
});
