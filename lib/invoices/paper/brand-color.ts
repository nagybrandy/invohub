// lib/invoices/paper/brand-color.ts
// Colour tokens of Dóri's invoice paper, derived from the one brand colour the
// user chose (docs/design/invoice-paper-2026-11/paper-css.md §3):
//   ink  (--bd)   the brand colour darkened until it reaches 4.5:1 on white
//   tint (--tint) the ORIGINAL colour at 12 % over white (pdfkit has no alpha)
// Header text, rules, the table header fill and the logo all use `ink`, never
// the raw colour, so white-on-ink and ink-on-white always read.
import { DEFAULT_PDF_TEMPLATE, normalizeHexColor } from "@/lib/invoices/pdf-template/defaults";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex([r, g, b]: Rgb): string {
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => byte(v).toString(16).padStart(2, "0")).join("")}`;
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio of `hex` on a white background. */
export function contrastOnWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

const MIN_CONTRAST = 4.5;
const LIGHTNESS_STEP = 0.02;
const LIGHTNESS_FLOOR = 0.05;

/**
 * The brand colour darkened (lightness -0.02 per step, hue and saturation
 * kept) until it reaches 4.5:1 on white or the lightness floor. Always a
 * lowercase #rrggbb; a colour that already passes is returned unchanged.
 */
export function darkOf(hex: string): string {
  const normalized = normalizeHexColor(hex, DEFAULT_PDF_TEMPLATE.accentColor).toLowerCase();
  if (contrastOnWhite(normalized) >= MIN_CONTRAST) return normalized;
  const [h, s, startL] = rgbToHsl(hexToRgb(normalized));
  let l = startL;
  let candidate = normalized;
  while (contrastOnWhite(candidate) < MIN_CONTRAST && l > LIGHTNESS_FLOOR) {
    l = Math.max(LIGHTNESS_FLOOR, l - LIGHTNESS_STEP);
    candidate = rgbToHex(hslToRgb([h, s, l]));
  }
  return candidate;
}

/** `share` (0..1) of `hex` over white, as an opaque colour. */
export function mixWithWhite(hex: string, share: number): string {
  const normalized = normalizeHexColor(hex, DEFAULT_PDF_TEMPLATE.accentColor);
  const k = Math.max(0, Math.min(1, share));
  const [r, g, b] = hexToRgb(normalized);
  return rgbToHex([255 + (r - 255) * k, 255 + (g - 255) * k, 255 + (b - 255) * k]);
}

export type PaperPalette = {
  /** Header colour, rules, table header fill, logo fill (>= 4.5:1 on white). */
  ink: string;
  /** Meta / party / strip band fill (12 % of the chosen colour). */
  tint: string;
  /** Border of the Keretes meta strip (35 % of ink). */
  frameBorder: string;
};

export function inkOf(accentColor: string): string {
  return darkOf(accentColor);
}

export function paperPalette(accentColor: string): PaperPalette {
  const ink = darkOf(accentColor);
  return {
    ink,
    tint: mixWithWhite(accentColor, 0.12),
    frameBorder: mixWithWhite(ink, 0.35),
  };
}
