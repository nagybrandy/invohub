// tailwind.config.js
// NativeWind preset and the redesign-2026-11 token mapping shared across web and native.
// Colour vars come from lib/theme/tokens.ts via global.css: the Gluestack names
// (`--background`, `--card`, ...) and an `-rgb` triplet twin of every design
// token (`--canvas-rgb`, `--ok-rgb`, ...) so opacity modifiers work.
const { hairlineWidth } = require("nativewind/theme");

const rgb = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // lib/ui holds the type-scale class presets (lib/ui/type.ts); without it
  // classes such as text-[30px] / leading-[1.1] are never generated.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/ui/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // App breakpoints (SPEC §3): phone <= 700, tab >= 701, wide >= 1100.
      screens: {
        phone: { max: "700px" },
        tab: "701px",
        wide: "1100px",
      },
      fontFamily: {
        sans: ["Stack Sans Text", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        body: ["Stack Sans Text", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        heading: [
          "Stack Sans Notch",
          "Stack Sans Text",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        // Named "subtle" (not "border-subtle") so Tailwind's border-color
        // plugin generates the utility our components actually use:
        // `border-subtle` (border-{colorKey}), not `border-border-subtle`.
        subtle: "rgb(var(--border-subtle) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        "hard-shadow": "rgb(var(--hard-shadow) / <alpha-value>)",
        // --- redesign-2026-11 design tokens (new code uses these names) ---
        canvas: rgb("canvas"),
        surface: rgb("surface"),
        line: rgb("line"),
        "line-strong": rgb("line-strong"),
        ink: rgb("ink"),
        // `muted` is taken by the Gluestack neutral wash; the design's text
        // colour `--muted` is therefore `muted-ink`.
        "muted-ink": rgb("muted"),
        faint: rgb("faint"),
        "primary-press": rgb("primary-press"),
        "primary-ink": rgb("primary-ink"),
        "primary-wash": rgb("primary-wash"),
        "primary-line": rgb("primary-line"),
        ok: rgb("ok"),
        "ok-wash": rgb("ok-wash"),
        warn: rgb("warn"),
        "warn-wash": rgb("warn-wash"),
        err: rgb("err"),
        "err-wash": rgb("err-wash"),
        "err-line": rgb("err-line"),
        "neutral-wash": rgb("neutral-wash"),
        wash2: rgb("wash2"),
        navy: rgb("navy"),
        "navy-ink": rgb("navy-ink"),
        "seg-track": rgb("seg-track"),
        "seg-active": rgb("seg-active"),
        "seg-active-ink": rgb("seg-active-ink"),
        "seg-ink": rgb("seg-ink"),
        "seg-hover": rgb("seg-hover"),
        "seg-line": rgb("seg-line"),
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        marketing: "1.75rem",
        // Design radii (tokens.md §4).
        card: "12px",
        control: "8px",
        menu: "12px",
        dialog: "16px",
        sheet: "18px",
        pill: "6px",
      },
      boxShadow: {
        hard1: "2px 2px 0 rgb(var(--hard-shadow) / 0.16)",
        // tokens.md §4. `card` follows the theme through --shadow.
        card: "var(--shadow)",
        menu: "0 14px 40px rgba(19, 31, 74, 0.22)",
        create: "0 16px 44px rgba(19, 31, 74, 0.28)",
        panel: "0 18px 50px rgba(19, 31, 74, 0.28), 0 0 0 1px rgb(var(--line-rgb))",
        dialog: "0 20px 60px rgba(10, 16, 40, 0.4)",
        sheet: "0 -10px 40px rgba(19, 31, 74, 0.3)",
        tooltip: "0 6px 18px rgba(19, 31, 74, 0.3)",
        tabbar: "0 -4px 18px rgba(19, 31, 74, 0.06)",
      },
    },
  },
  plugins: [],
};
