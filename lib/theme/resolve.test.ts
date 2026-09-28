// lib/theme/resolve.test.ts
import { nextThemePreference, resolveColorScheme } from "@/lib/theme/resolve";

describe("resolveColorScheme — preference wins, otherwise the platform decides", () => {
  it("defers to the system when nothing is stored or 'system' is stored", () => {
    expect(resolveColorScheme(null, "dark")).toBe("dark");
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
  });

  it("never guesses dark from an unknown platform value", () => {
    expect(resolveColorScheme("system", null)).toBe("light");
    expect(resolveColorScheme(null, undefined)).toBe("light");
  });

  it("lets an explicit choice override a contrary OS setting", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
  });
});

describe("nextThemePreference — the Settings tile cycles through the three choices", () => {
  it("goes system → light → dark → system", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("treats 'nothing stored yet' as system", () => {
    expect(nextThemePreference(null)).toBe("light");
  });
});
