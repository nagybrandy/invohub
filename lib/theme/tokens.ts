// lib/theme/tokens.ts
// Single source of truth for the redesign-2026-11 design tokens
// (docs/design/redesign-2026-11/tokens.md §1). Two naming layers are kept so
// every existing className keeps compiling:
//   - the design tokens (`canvas`, `surface`, `ink`, `ok`, ...) as hex, plus an
//     `-rgb` triplet twin each so Tailwind can apply alpha;
//   - the Gluestack/NativeWind names (`--background`, `--card`, `--primary`,
//     ...) as space-separated RGB triplets, mapped per SPEC §1.1.
// `lib/theme/theme-css.ts` turns this file into the CSS in global.css.
export type ThemeTokenSet = Record<string, string>;

/** Design tokens, hex, exactly as in tokens.md §1. */
export const designPalette = {
  light: {
    canvas: "#F6F6F8",
    surface: "#FFFFFF",
    line: "#E6E8EC",
    "line-strong": "#C5C7CA",
    ink: "#212325",
    muted: "#5B5D61",
    faint: "#8A8D92",
    primary: "#3F6BC4",
    "primary-press": "#335AA8",
    "primary-ink": "#1F305E",
    "primary-wash": "#E6EEFC",
    "primary-line": "#BFD0F2",
    ok: "#1B7A4F",
    "ok-wash": "#E1F4EA",
    warn: "#8A5200",
    "warn-wash": "#FFF1D1",
    err: "#C62828",
    "err-wash": "#FDECEC",
    "err-line": "#E7B4B4",
    "neutral-wash": "#EEF0F4",
    wash2: "#FAFBFD",
    navy: "#131F4A",
    "navy-ink": "#C9D3F0",
    "seg-track": "#FFFFFF",
    "seg-active": "#1F305E",
    "seg-active-ink": "#F6F6F8",
    "seg-ink": "#212325",
    "seg-hover": "#F2F5FB",
    "seg-line": "#C5C7CA",
  },
  dark: {
    canvas: "#0A0D12",
    surface: "#171A20",
    line: "#262A33",
    "line-strong": "#3A3F4B",
    ink: "#E7E9ED",
    muted: "#A0A6B2",
    faint: "#7B8190",
    primary: "#5A85E0",
    "primary-press": "#4C74CB",
    "primary-ink": "#CFDDFB",
    "primary-wash": "#1B2745",
    "primary-line": "#2F4A85",
    ok: "#4CC38A",
    "ok-wash": "#12301F",
    warn: "#F0B35A",
    "warn-wash": "#33260D",
    err: "#F26B6B",
    "err-wash": "#3A1A1C",
    "err-line": "#6B2B2E",
    "neutral-wash": "#222630",
    wash2: "#1C1F26",
    navy: "#0B1230",
    // `--navy-ink` is not overridden in dark: same as light.
    "navy-ink": "#C9D3F0",
    "seg-track": "#1E2229",
    "seg-active": "#5A85E0",
    "seg-active-ink": "#FFFFFF",
    "seg-ink": "#E7E9ED",
    "seg-hover": "#262B35",
    "seg-line": "#3A3F4B",
  },
} as const;

export type DesignTokenName = keyof (typeof designPalette)["light"];

export const DESIGN_TOKEN_NAMES = Object.keys(designPalette.light) as DesignTokenName[];

/**
 * Design tokens whose hex variable would collide with a Gluestack name that
 * already means something else (`--primary` and `--muted` are RGB triplets
 * used by the old class names). These are only available as `--primary-rgb` /
 * `--muted-rgb`.
 */
export const HEX_VAR_COLLISIONS: ReadonlySet<DesignTokenName> = new Set(["primary", "muted"]);

const WHITE = "#FFFFFF";

/** "#3F6BC4" -> "63 107 196" */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

type Scheme = "light" | "dark";

/** Gluestack/NativeWind names -> the design token each one is driven by (SPEC §1.1). */
const GLUESTACK_MAP: Record<string, DesignTokenName | "white"> = {
  "--background": "canvas",
  "--card": "surface",
  "--popover": "surface",
  "--surface-raised": "surface",
  "--input": "surface",
  "--foreground": "ink",
  "--card-foreground": "ink",
  "--popover-foreground": "ink",
  "--muted-foreground": "muted",
  "--muted": "neutral-wash",
  "--border-subtle": "line",
  "--border": "line-strong",
  "--primary": "primary",
  "--ring": "primary",
  "--primary-foreground": "white",
  "--destructive-foreground": "white",
  "--secondary": "navy",
  "--secondary-foreground": "navy-ink",
  "--accent": "primary-wash",
  "--accent-foreground": "primary-ink",
  "--destructive": "err",
};

function buildTriplets(scheme: Scheme): ThemeTokenSet {
  const palette = designPalette[scheme];
  const out: ThemeTokenSet = {};
  for (const [cssVar, token] of Object.entries(GLUESTACK_MAP)) {
    out[cssVar] = hexToRgbTriplet(token === "white" ? WHITE : palette[token]);
  }
  for (const name of DESIGN_TOKEN_NAMES) {
    out[`--${name}-rgb`] = hexToRgbTriplet(palette[name]);
  }
  return out;
}

/** Hex design variables (`--canvas: #F6F6F8`), minus the two collisions. */
export function designHexVars(scheme: Scheme): ThemeTokenSet {
  const palette = designPalette[scheme];
  const out: ThemeTokenSet = {};
  for (const name of DESIGN_TOKEN_NAMES) {
    if (HEX_VAR_COLLISIONS.has(name)) continue;
    out[`--${name}`] = palette[name];
  }
  return out;
}

/** RGB-triplet vars: the Gluestack names plus a `-rgb` twin of every design token. */
export const themeTokens: { light: ThemeTokenSet; dark: ThemeTokenSet } = {
  light: {
    ...buildTriplets("light"),
    "--hard-shadow": "33 35 37",
  },
  dark: buildTriplets("dark"),
};

/** Card shadow (`--shadow`), per theme: tokens.md §4. */
export const shadowVars: { light: string; dark: string } = {
  light: "0 1px 2px rgba(19,31,74,.06), 0 6px 22px rgba(19,31,74,.06)",
  dark: "0 1px 2px rgba(0,0,0,.4), 0 6px 22px rgba(0,0,0,.35)",
};

export const invoHubDesignTokens = {
  color: {
    ...designPalette.light,
  },
  radius: {
    /** controls: buttons, inputs, menu rows */
    control: 8,
    card: 12,
    menu: 12,
    dialog: 16,
    sheet: 18,
    /** status pill */
    pill: 6,
    /** legacy scale, still used by older components */
    lg: 8,
    xl: 12,
    "2xl": 16,
    "3xl": 24,
    /** Marketing panels / infographic frames */
    marketing: 28,
  },
  spacing: [2, 4, 8, 10, 12, 16, 18, 24, 32, 36, 40],
  typography: {
    body: '"Stack Sans Text", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    heading:
      '"Stack Sans Notch", "Stack Sans Text", system-ui, -apple-system, "Segoe UI", sans-serif',
    display: {
      hero: { mobile: 40, desktop: 48 },
      section: { mobile: 30, desktop: 36 },
    },
  },
  shadow: {
    hard1: "2px 2px 0 rgba(33, 35, 37, 0.16)",
  },
  marketing: {
    surfaceHero: designPalette.light.navy,
    surfaceSoft: designPalette.light.canvas,
    surfacePanel: designPalette.light["primary-ink"],
  },
} as const;

/** Hex colors for Lucide icons (RN does not resolve CSS vars on icons). */
function buildIconColors(scheme: Scheme) {
  const p = designPalette[scheme];
  return {
    primary: p.primary,
    muted: p.muted,
    faint: p.faint,
    foreground: p.ink,
    destructive: p.err,
    ok: p.ok,
    warn: p.warn,
    accent: p.primary,
    accentForeground: p["primary-ink"],
    secondary: p.navy,
    /** Icon/text colour on the (always navy) sidebar. */
    onNavy: p["navy-ink"],
    onNavyActive: WHITE,
  };
}

export const iconColors = {
  light: buildIconColors("light"),
  dark: buildIconColors("dark"),
} as const;

export type IconColorSet = (typeof iconColors)["light"] | (typeof iconColors)["dark"];

export type ThemeColorName = keyof typeof themeTokens.light;
