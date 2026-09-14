// lib/theme/layout.ts
// Shared layout constants (shell/content widths, sidebar + topstrip sizing,
// desktop breakpoint) used across the signed-in app shell and screens so
// every screen agrees on the same max-widths instead of inventing its own.
export const LAYOUT = {
  shellMax: 1440,
  contentMax: 1200,
  formMax: 720,
  proseMax: 640,
  sidebarWidth: 248,
  sidebarCollapsed: 72,
  topStripHeight: 56,
  desktopBreakpoint: 1024,
} as const;

export type LayoutTokens = typeof LAYOUT;
