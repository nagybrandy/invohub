// lib/ui/tap-target.ts
// Single source of truth for the minimum interactive tap-target size used
// across the invoice flow (Apple HIG 44pt / WCAG 2.5.8 AAA). Every pill,
// tab, and icon button that renders a tap target imports these instead of
// hardcoding a class string, so the floor can't silently regress per call
// site.
export const MIN_TAP_TARGET_PX = 44;

/** Tailwind/NativeWind class for the floor: min-h-11 = 2.75rem = 44px. */
export const TAP_TARGET_MIN_H = "min-h-11";

/** Square icon-button target (bell, row actions): 44x44px, centered content. */
export const TAP_TARGET_ICON_BOX = "h-11 w-11 items-center justify-center";
