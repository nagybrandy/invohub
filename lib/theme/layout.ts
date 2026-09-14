// lib/theme/layout.ts
// Shared desktop-first layout constants — content widths, shell dimensions,
// and the breakpoint every screen/shell must agree on. See
// docs/design/app-ux-spec-2026-09-14.md §4.1.
export const LAYOUT = {
  /** Outer shell max width (sidebar + content). */
  shellMax: 1440,
  /** Default max width for page content (ScreenLayout width="content"). */
  contentMax: 1200,
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
  /** Below this width, the mobile shell (bottom tabs) renders instead of the sidebar. */
  desktopBreakpoint: 1024,
} as const;

export type LayoutTokens = typeof LAYOUT;
