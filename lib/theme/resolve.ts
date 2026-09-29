// lib/theme/resolve.ts
// Pure theme decisions: which concrete scheme a preference resolves to, and
// what the Settings appearance tile cycles to next.
import type { ThemePreference } from "@/lib/theme-preference";

export type ColorScheme = "light" | "dark";

// "system" (or nothing stored yet) defers to whatever the platform reports;
// an unknown platform value falls back to light rather than guessing dark.
export function resolveColorScheme(
  preference: ThemePreference | null,
  system: string | null | undefined,
): ColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return system === "dark" ? "dark" : "light";
}

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

export function nextThemePreference(current: ThemePreference | null): ThemePreference {
  const index = CYCLE.indexOf(current ?? "system");
  return CYCLE[(index + 1) % CYCLE.length];
}
