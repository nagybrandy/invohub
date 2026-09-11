// lib/theme/tokens.ts
// Single source of truth for customized Gluestack design tokens (RGB space-separated for NativeWind).
export type ThemeTokenSet = Record<string, string>;

export const invoHubDesignTokens = {
  color: {
    primary50: "#d9e7ff",
    primary500: "#6495ed",
    primary600: "#4675ca",
    primary800: "#153a7f",
    secondary500: "#1f305e",
    secondary700: "#111f4a",
    typography900: "#212325",
    typography800: "#323336",
    typography600: "#5b5d61",
    typography500: "#696a6e",
    typography200: "#c5c7ca",
    typography100: "#e4e6e8",
    typography0: "#f9f9f9",
    background50: "#ffffff",
    background0: "#f6f6f8",
    background300: "#a6a8ab",
    background600: "#5b5d61",
    light: "#fbfbfb",
    border200: "#c5c7ca",
    border100: "#e4e6e8",
    border400: "#8e9094",
  },
  radius: { lg: 8, xl: 12, "2xl": 16, "3xl": 24 },
  spacing: [2, 4, 8, 10, 12, 16, 18, 24, 32, 36, 40],
  typography: {
    body: '"Stack Sans Text", Inter, system-ui, sans-serif',
    heading: '"Stack Sans Notch", "Stack Sans Text", Inter, system-ui, sans-serif',
  },
  shadow: {
    hard1: "2px 2px 0 rgba(33, 35, 37, 0.16)",
  },
} as const;

export const themeTokens: { light: ThemeTokenSet; dark: ThemeTokenSet } = {
  light: {
    "--background": "246 246 248",
    "--foreground": "33 35 37",
    "--card": "255 255 255",
    "--card-foreground": "33 35 37",
    "--popover": "255 255 255",
    "--popover-foreground": "33 35 37",
    "--primary": "100 149 237",
    "--primary-foreground": "255 255 255",
    "--secondary": "17 31 74",
    "--secondary-foreground": "228 230 232",
    "--muted": "249 249 249",
    "--muted-foreground": "91 93 97",
    "--accent": "217 231 255",
    "--accent-foreground": "31 48 94",
    "--destructive": "220 38 38",
    "--destructive-foreground": "255 255 255",
    "--border": "197 199 202",
    "--input": "255 255 255",
    "--ring": "100 149 237",
    "--hard-shadow": "33 35 37",
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
    "--accent": "21 58 127",
    "--accent-foreground": "228 230 232",
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
    muted: "#5b5d61",
    foreground: "#212325",
    destructive: "#dc2626",
    accent: "#6495ed",
    accentForeground: "#1f305e",
    secondary: "#111f4a",
  },
  dark: {
    primary: "#78a5f0",
    muted: "#b4becf",
    foreground: "#f1f5f9",
    destructive: "#f87171",
    accent: "#78a5f0",
    accentForeground: "#e2e8f0",
    secondary: "#293a68",
  },
} as const;

export type IconColorSet =
  (typeof iconColors)["light"] | (typeof iconColors)["dark"];

export type ThemeColorName = keyof typeof themeTokens.light;
