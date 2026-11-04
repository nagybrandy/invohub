// lib/ui/fonts.test.ts
import {
  nativeFontFamily,
  NATIVE_FONT_FAMILIES,
  roleFromClassName,
  snapWeight,
  weightFromClassName,
} from "@/lib/ui/fonts";

describe("nativeFontFamily", () => {
  it("maps 400/500/600/700 to the static @expo-google-fonts family names", () => {
    expect(nativeFontFamily(400, "body")).toBe("StackSansText_400Regular");
    expect(nativeFontFamily(500, "body")).toBe("StackSansText_500Medium");
    expect(nativeFontFamily(600, "body")).toBe("StackSansText_600SemiBold");
    expect(nativeFontFamily(700, "body")).toBe("StackSansText_700Bold");
    expect(nativeFontFamily(700, "heading")).toBe("StackSansNotch_700Bold");
    expect(nativeFontFamily(undefined, "heading")).toBe("StackSansNotch_400Regular");
  });

  it("snaps other weights to the nearest cut we ship", () => {
    expect(snapWeight(200)).toBe(400);
    expect(snapWeight(300)).toBe(400);
    expect(snapWeight(450)).toBe(500);
    expect(snapWeight(549)).toBe(500);
    expect(snapWeight(550)).toBe(600);
    expect(snapWeight(650)).toBe(700);
    expect(snapWeight(900)).toBe(700);
  });

  it("covers every role and step", () => {
    for (const role of ["body", "heading"] as const) {
      expect(Object.keys(NATIVE_FONT_FAMILIES[role])).toHaveLength(4);
    }
  });
});

describe("weightFromClassName", () => {
  it("reads Tailwind weight utilities", () => {
    expect(weightFromClassName("text-sm font-medium")).toBe(500);
    expect(weightFromClassName("font-semibold text-ink")).toBe(600);
    expect(weightFromClassName("font-bold")).toBe(700);
    expect(weightFromClassName("font-light")).toBe(400);
    expect(weightFromClassName("font-normal")).toBe(400);
  });

  it("the last utility wins, including variant-prefixed ones being ignored by prefix match", () => {
    expect(weightFromClassName("font-medium font-bold")).toBe(700);
    expect(weightFromClassName("font-bold font-normal")).toBe(400);
  });

  it("uses the bold flag then the fallback when no utility is present", () => {
    expect(weightFromClassName("text-sm", { bold: true })).toBe(700);
    expect(weightFromClassName("text-sm")).toBe(400);
    expect(weightFromClassName(undefined, { fallback: 700 })).toBe(700);
  });

  it("does not mistake font-heading or font-sans for a weight", () => {
    expect(weightFromClassName("font-heading text-lg")).toBe(400);
    expect(weightFromClassName("font-sans")).toBe(400);
  });
});

describe("roleFromClassName", () => {
  it("detects the heading family", () => {
    expect(roleFromClassName("font-heading text-xl")).toBe("heading");
    expect(roleFromClassName("text-xl")).toBe("body");
    expect(roleFromClassName("text-xl", "heading")).toBe("heading");
    expect(roleFromClassName("font-body", "heading")).toBe("body");
  });
});
