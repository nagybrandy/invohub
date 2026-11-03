// lib/ui/fonts.ts
// Stack Sans on native. The web loads one variable font per family
// (global.css), where `font-weight` simply works. React Native cannot pick a
// weight out of one family name, so on iOS/Android we load the static
// 400/500/600/700 cuts (@expo-google-fonts, see lib/ui/use-app-fonts.native.ts)
// and map the weight utilities in a className to the matching static family.
export type FontRole = "body" | "heading";
export type FontWeightStep = 400 | 500 | 600 | 700;

/** Static family names registered by @expo-google-fonts/stack-sans-{text,notch}. */
export const NATIVE_FONT_FAMILIES: Record<FontRole, Record<FontWeightStep, string>> = {
  body: {
    400: "StackSansText_400Regular",
    500: "StackSansText_500Medium",
    600: "StackSansText_600SemiBold",
    700: "StackSansText_700Bold",
  },
  heading: {
    400: "StackSansNotch_400Regular",
    500: "StackSansNotch_500Medium",
    600: "StackSansNotch_600SemiBold",
    700: "StackSansNotch_700Bold",
  },
};

const WEIGHT_CLASS: Record<string, FontWeightStep> = {
  thin: 400,
  extralight: 400,
  light: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 700,
  black: 700,
};

/** Snap any CSS weight to the nearest static cut we ship. */
export function snapWeight(weight: number): FontWeightStep {
  if (weight < 450) return 400;
  if (weight < 550) return 500;
  if (weight < 650) return 600;
  return 700;
}

/**
 * Weight implied by a className / bold flag. The LAST weight utility in the
 * string wins (the same order Tailwind users expect when overriding a default).
 */
export function weightFromClassName(
  className: string | undefined,
  options: { bold?: boolean; fallback?: FontWeightStep } = {},
): FontWeightStep {
  const fallback = options.fallback ?? 400;
  let found: FontWeightStep | undefined;
  if (className) {
    for (const match of className.matchAll(/(?:^|\s)(?:[a-z-]+:)*font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?=\s|$)/g)) {
      found = WEIGHT_CLASS[match[1]];
    }
  }
  if (found) return found;
  return options.bold ? 700 : fallback;
}

/** Static family name for a weight and role (native only). */
export function nativeFontFamily(weight: number | undefined, role: FontRole): string {
  return NATIVE_FONT_FAMILIES[role][snapWeight(weight ?? 400)];
}

/**
 * The inline style that selects the right static cut on native. `fontWeight`
 * is reset to normal because the weight is already baked into the family;
 * leaving NativeWind's `font-semibold` weight on top would make Android fake
 * a second bold. Apply on native only.
 */
export function nativeFontStyle(
  className: string | undefined,
  options: { role?: FontRole; fallbackWeight?: FontWeightStep; bold?: boolean } = {},
): { fontFamily: string; fontWeight: "normal" } {
  const role = roleFromClassName(className, options.role ?? "body");
  const weight = weightFromClassName(className, { bold: options.bold, fallback: options.fallbackWeight });
  return { fontFamily: nativeFontFamily(weight, role), fontWeight: "normal" };
}

/** Heading role when the className asks for the heading family. */
export function roleFromClassName(className: string | undefined, fallback: FontRole = "body"): FontRole {
  if (className && /(?:^|\s)font-heading(?=\s|$)/.test(className)) return "heading";
  if (className && /(?:^|\s)font-(?:body|sans)(?=\s|$)/.test(className)) return "body";
  return fallback;
}
