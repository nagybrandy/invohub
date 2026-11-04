// lib/theme/layout.ts
// Shared desktop-first layout constants — content widths, shell dimensions,
// and the breakpoint every screen/shell must agree on. See
// docs/design/app-ux-spec-2026-09-14.md §4.1.
export const LAYOUT = {
  /** Outer shell max width (sidebar + content). */
  shellMax: 1440,
  /** Default max width for dashboard and list content (ScreenLayout width="content"), tokens.md §4. */
  contentMax: 1160,
  /** Settings pages (width="settings"). */
  settingsMax: 1120,
  /** Composer pages (width="composer"). */
  composerMax: 1240,
  /** Max width for a form field column (ScreenLayout width="form"). */
  formMax: 720,
  /** Max width for long-form prose / explanatory text blocks. */
  proseMax: 640,
  /** Desktop sidebar width, expanded. */
  sidebarWidth: 248,
  /** Desktop sidebar width, collapsed (icon-only). */
  sidebarCollapsed: 72,
  /** Desktop top strip height. */
  topStripHeight: 56,
  /** Phone tab bar height (without the safe-area inset). */
  tabBarHeight: 64,
  /** Phone: widths up to and including this get the mobile shell (tab bar, bottom sheets). */
  phoneMax: 700,
  /** Widths from this up get the expanded sidebar by default and two-column page grids. */
  wideMin: 1100,
  /** A list whose own (measured) width is at most this renders cards instead of a table. */
  listCardsMax: 820,
  /** A settings pane at least this wide goes two-column (label left, control right). */
  settingsTwoColumnMin: 640,
  /** Invoice customisation: preview beside the form from this pane width. */
  previewBesideMin: 760,
} as const;

export type Breakpoint = "phone" | "tablet" | "wide";

/** phone <= 700 < tablet < 1100 <= wide (SPEC §3). */
export function breakpointForWidth(width: number): Breakpoint {
  if (width <= LAYOUT.phoneMax) return "phone";
  if (width >= LAYOUT.wideMin) return "wide";
  return "tablet";
}

export type LayoutTokens = typeof LAYOUT;
