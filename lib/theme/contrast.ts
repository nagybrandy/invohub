// lib/theme/contrast.ts
// WCAG 2.x colour-contrast primitives, pure and dependency-free. Used to
// assert (not just eyeball) that document typography inks clear the AA
// bar — see lib/invoices/document-ink.ts. Deliberately separate from the
// YIQ approximation `readableTextOn` in lib/invoices/pdf-layout.ts, which
// picks white-vs-navy for a filled band and stays as-is (out of scope
// here — see docs/plans/2026-09-21-pdf-footer-attribution-contrast.md §9).

/** The WCAG 2.x "AA, normal text" minimum contrast ratio. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

function hexToChannels(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.x relative luminance of a `#rrggbb` colour, in [0, 1].
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex);
  const [rLin, gLin, bLin] = [channelToLinear(r), channelToLinear(g), channelToLinear(b)];
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * WCAG 2.x contrast ratio between two `#rrggbb` colours, in [1, 21].
 * Symmetric in its two arguments — order does not matter.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
