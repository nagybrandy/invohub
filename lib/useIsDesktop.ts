// lib/useIsDesktop.ts
// Responsive breakpoint helpers shared across layout and preview components.
// SPEC §3: phone <= 700, tablet 701-1099, wide >= 1100. "Desktop" means "the
// sidebar shell renders" (>= 701), not "wide".
import { useWindowDimensions } from "react-native";
import { breakpointForWidth, LAYOUT, type Breakpoint } from "@/lib/theme/layout";

export const DESKTOP_BREAKPOINT = LAYOUT.phoneMax + 1;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointForWidth(width);
}
