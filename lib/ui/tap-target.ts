// lib/ui/tap-target.ts
// Single source of truth for the minimum interactive tap-target size used
// across the invoice flow (Apple HIG 44pt / WCAG 2.5.8 AAA). Every pill,
// tab, and icon button that renders a tap target imports these instead of
// hardcoding a class string, so the floor can't silently regress per call
// site.
export const MIN_TAP_TARGET_PX = 44;

/** Tailwind/NativeWind class for the floor: min-h-11 = 2.75rem = 44px. */
export const TAP_TARGET_MIN_H = "min-h-11";

/** Fixed 44px height, for controls whose children depend on `h-full`. */
export const TAP_TARGET_H = "h-11";

/** Square icon-button target (bell, row actions): 44x44px, centered content. */
export const TAP_TARGET_ICON_BOX = `${TAP_TARGET_H} w-11 items-center justify-center`;

/**
 * Tailwind `top-*` offset for an absolutely-positioned dropdown/menu anchored
 * directly below a row that is `TAP_TARGET_H` tall (e.g. a description or
 * unit-picker menu under a 44px input). Tailwind's `top-*` and `h-*` scales
 * share the same steps, so swapping the `h-` prefix for `top-` derives the
 * matching offset from the same constant instead of a second literal that
 * can drift from the row height it is meant to sit under.
 */
export const TAP_TARGET_DROPDOWN_TOP = TAP_TARGET_H.replace(/^h-/, "top-");

/** Default outward touch slop, in px, for controls at the 44px floor. */
export const TAP_SLOP_PX = 8;

export type HitSlopRect = { top: number; right: number; bottom: number; left: number };
export type TapSide = "top" | "right" | "bottom" | "left";

/**
 * hitSlop with `slop` on every side EXCEPT the listed ones, which get 0.
 * Use it on any side that faces an adjacent interactive control: slop that
 * reaches across a small gap silently steals taps from the neighbour, and
 * which control wins is a platform hit-test detail, not a design decision.
 */
export function hitSlopExcept(sides: readonly TapSide[], slop = TAP_SLOP_PX): HitSlopRect {
  const excluded = new Set(sides);
  return {
    top: excluded.has("top") ? 0 : slop,
    right: excluded.has("right") ? 0 : slop,
    bottom: excluded.has("bottom") ? 0 : slop,
    left: excluded.has("left") ? 0 : slop,
  };
}

/**
 * Width in px of the band where two horizontally adjacent controls' touch
 * rects overlap. `gapPx` is the distance between their visual boxes; the two
 * arguments are the facing slops (the left control's right-side slop and the
 * right control's left-side slop). A boundary is only truly *contested* when
 * BOTH neighbours reach into it — if either side has already been trimmed to
 * 0, that side makes no competing claim, so the band resolves unambiguously
 * to the other control and is not counted as overlap. The mutual reach is
 * therefore bounded by the smaller of the two facing slops, doubled (each
 * side reaches that far), minus the gap they have to cross; the result is
 * clamped to 0 (never negative).
 */
export function touchOverlapPx(gapPx: number, leftSlopRight: number, rightSlopLeft: number): number {
  return Math.max(0, 2 * Math.min(leftSlopRight, rightSlopLeft) - gapPx);
}

/**
 * React Native's `Role` union has no "listbox" — the value predates it, but
 * react-native-web passes it straight through to the DOM role, and native
 * ignores a role it doesn't know. An autocomplete popup is a listbox in ARIA
 * terms (its rows are `option`s, which RN *does* know), so the one conversion
 * this needs lives here rather than at the call site.
 */
export const LISTBOX_ROLE = "listbox" as string as import("react-native").Role;
