// components/marketing/landing-theme.ts
// Shared landing-page brand tokens for icons, surfaces, and marketing typography.
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

export const landingSurfaces = {
  hero: landingColors.navy,
  panel: landingColors.depth,
  soft: landingColors.mist,
  canvas: "#f6f6f8",
  glass: "rgba(255, 255, 255, 0.08)",
} as const;

export const landingRadii = {
  panel: 28,
  card: 24,
  control: 12,
} as const;

export const landingDisplayType = {
  heroDesktop: "text-5xl",
  heroMobile: "text-[40px]",
  section: "text-3xl md:text-4xl",
  kicker: "text-xs font-semibold uppercase tracking-[2px]",
} as const;
