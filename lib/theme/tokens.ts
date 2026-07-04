// lib/theme/tokens.ts
// Single source of truth for design tokens (RGB space-separated for NativeWind rgb()).
export type ThemeTokenSet = Record<string, string>;

export const themeTokens: { light: ThemeTokenSet; dark: ThemeTokenSet } = {
  light: {
    "--background": "248 250 252",
    "--foreground": "15 23 42",
    "--card": "255 255 255",
    "--card-foreground": "15 23 42",
    "--popover": "255 255 255",
    "--popover-foreground": "15 23 42",
    "--primary": "79 70 229",
    "--primary-foreground": "255 255 255",
    "--secondary": "241 245 249",
    "--secondary-foreground": "30 41 59",
    "--muted": "241 245 249",
    "--muted-foreground": "100 116 139",
    "--accent": "238 242 255",
    "--accent-foreground": "67 56 202",
    "--destructive": "220 38 38",
    "--destructive-foreground": "255 255 255",
    "--border": "226 232 240",
    "--input": "255 255 255",
    "--ring": "79 70 229",
  },
  dark: {
    "--background": "9 11 16",
    "--foreground": "241 245 249",
    "--card": "18 22 30",
    "--card-foreground": "241 245 249",
    "--popover": "18 22 30",
    "--popover-foreground": "241 245 249",
    "--primary": "99 102 241",
    "--primary-foreground": "255 255 255",
    "--secondary": "35 42 58",
    "--secondary-foreground": "226 232 240",
    "--muted": "27 32 44",
    "--muted-foreground": "180 190 204",
    "--accent": "30 38 56",
    "--accent-foreground": "199 210 254",
    "--destructive": "248 113 113",
    "--destructive-foreground": "255 255 255",
    "--border": "38 45 61",
    "--input": "27 32 44",
    "--ring": "129 140 248",
  },
};

/** Hex colors for Lucide icons (RN does not resolve CSS vars on icons). */
export const iconColors = {
  light: {
    primary: "#4f46e5",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#6366f1",
    accentForeground: "#4338ca",
  },
  dark: {
    primary: "#818cf8",
    muted: "#b4becf",
    foreground: "#f1f5f9",
    destructive: "#f87171",
    accent: "#a5b4fc",
    accentForeground: "#c7d2fe",
  },
} as const;

export type IconColorSet = (typeof iconColors)["light"];
