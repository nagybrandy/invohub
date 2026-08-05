// lib/theme/tokens.ts
// Single source of truth for design tokens (RGB space-separated for NativeWind rgb()).
export type ThemeTokenSet = Record<string, string>;

export const themeTokens: { light: ThemeTokenSet; dark: ThemeTokenSet } = {
  light: {
    "--background": "248 250 252",
    "--foreground": "15 23 42",
    "--card": "255 255 255",
    "--card-foreground": "15 23 42",
    "--popover": "250 251 252",
    "--popover-foreground": "15 23 42",
    "--primary": "100 149 237",
    "--primary-foreground": "255 255 255",
    "--secondary": "17 31 74",
    "--secondary-foreground": "228 230 232",
    "--muted": "241 245 249",
    "--muted-foreground": "100 116 139",
    "--accent": "141 182 0",
    "--accent-foreground": "255 255 255",
    "--destructive": "220 38 38",
    "--destructive-foreground": "255 255 255",
    "--border": "226 232 240",
    "--input": "255 255 255",
    "--ring": "100 149 237",
  },
  dark: {
    "--background": "9 11 16",
    "--foreground": "241 245 249",
    "--card": "18 22 30",
    "--card-foreground": "241 245 249",
    "--popover": "24 28 38",
    "--popover-foreground": "241 245 249",
    "--primary": "120 165 240",
    "--primary-foreground": "255 255 255",
    "--secondary": "41 58 104",
    "--secondary-foreground": "226 232 240",
    "--muted": "27 32 44",
    "--muted-foreground": "180 190 204",
    "--accent": "110 145 10",
    "--accent-foreground": "255 255 255",
    "--destructive": "248 113 113",
    "--destructive-foreground": "255 255 255",
    "--border": "38 45 61",
    "--input": "27 32 44",
    "--ring": "120 165 240",
  },
};

/** Hex colors for Lucide icons (RN does not resolve CSS vars on icons). */
export const iconColors = {
  light: {
    primary: "#6495ed",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#8db600",
    accentForeground: "#1f305e",
    secondary: "#111f4a",
  },
  dark: {
    primary: "#78a5f0",
    muted: "#b4becf",
    foreground: "#f1f5f9",
    destructive: "#f87171",
    accent: "#6e910a",
    accentForeground: "#e2e8f0",
    secondary: "#293a68",
  },
} as const;

export type IconColorSet =
  (typeof iconColors)["light"] | (typeof iconColors)["dark"];

export type ThemeColorName = keyof typeof themeTokens.light;
