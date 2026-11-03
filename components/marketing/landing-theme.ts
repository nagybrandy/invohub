// components/marketing/landing-theme.ts
// Shared layout and type presets of the public pages (redesign 2026-11,
// SPEC §10): the 1160px container, section rhythm, eyebrow / h2 / lead styles
// and the breakpoints at which the landing changes shape. Colours come from
// the theme tokens (classNames); `landingColors` stays only for the places
// that need a literal value (the invoice PDF's brand mark, which reads it).

export const landingColors = {
  navy: "#111f4a",
  depth: "#1f305e",
  cornflower: "#6495ed",
  paleBlue: "#d9e7ff",
  mist: "#edf2fa",
  white: "#ffffff",
  /** Success / paid only — never use as brand primary. */
  success: "#15803d",
  muted: "#697386",
} as const;

/** From this width the landing header shows links and the hero has two columns. */
export const LANDING_DESKTOP_MIN = 960;
/** From this width card grids use two columns. */
export const LANDING_TABLET_MIN = 701;

export type LandingColumns = 1 | 2 | 3;

/** Card-grid column count for a window width (3 wide, 2 tablet, 1 phone). */
export function landingColumns(width: number): LandingColumns {
  if (width >= LANDING_DESKTOP_MIN) return 3;
  if (width >= LANDING_TABLET_MIN) return 2;
  return 1;
}

export const landingRadii = {
  card: 12,
  panel: 16,
  control: 8,
} as const;

export const landingLayout = {
  /** Container: max 1160, 24px gutters (16 on phones). */
  container: "mx-auto w-full min-w-0 max-w-[1160px] px-4 tab:px-6",
  /** Section vertical rhythm. */
  section: "py-14 tab:py-[88px]",
  /** Scroll offset so anchored sections clear the 64px sticky header. */
  anchor: "web:scroll-mt-16",
} as const;

export const landingType = {
  /** 12/600 uppercase eyebrow above section titles. */
  eyebrow: "text-xs font-semibold uppercase tracking-[0.08em] text-primary",
  eyebrowOnNavy: "text-xs font-semibold uppercase tracking-[0.08em] text-navy-ink",
  /** Section h2: Notch 32/700, phone 24. */
  h2: "font-heading text-[32px] phone:text-2xl font-bold leading-[1.15] tracking-[-0.01em] text-ink",
  h2OnNavy: "font-heading text-[32px] phone:text-2xl font-bold leading-[1.15] tracking-[-0.01em] text-white",
  /** Section lead: 16 muted. */
  lead: "text-base leading-6 text-muted-ink",
  /** Card title: Notch 16/700. */
  cardTitle: "font-heading text-base font-bold leading-[1.25] text-ink",
  /** Card description: 14 muted. */
  cardBody: "text-sm leading-[22px] text-muted-ink",
  /** Hero h1: Notch 48/700, phone 32. */
  heroTitle:
    "font-heading text-[48px] phone:text-[32px] font-bold leading-[1.08] tracking-[-0.015em] text-white",
} as const;

/** Kept for existing imports: the section / kicker presets under their old names. */
export const landingDisplayType = {
  heroDesktop: "text-[48px]",
  heroMobile: "text-[32px]",
  section: landingType.h2,
  kicker: landingType.eyebrow,
} as const;
