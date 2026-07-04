// lib/theme/icon-colors.ts
// Theme-aware Lucide icon colors for React Native.
import { iconColors, type IconColorSet } from "@/lib/theme/tokens";
import { useColorScheme } from "@/lib/useColorScheme";

export function useIconColors(): IconColorSet {
  const { isDarkColorScheme } = useColorScheme();
  return isDarkColorScheme ? iconColors.dark : iconColors.light;
}
