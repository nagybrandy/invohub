// lib/ui/use-app-fonts.native.ts
// iOS/Android: load the static Stack Sans cuts (400/500/600/700) from
// @expo-google-fonts (SIL OFL 1.1) and keep the splash screen up until they
// are ready. The family names match lib/ui/fonts.ts NATIVE_FONT_FAMILIES.
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  StackSansNotch_400Regular,
  StackSansNotch_500Medium,
  StackSansNotch_600SemiBold,
  StackSansNotch_700Bold,
} from "@expo-google-fonts/stack-sans-notch";
import {
  StackSansText_400Regular,
  StackSansText_500Medium,
  StackSansText_600SemiBold,
  StackSansText_700Bold,
} from "@expo-google-fonts/stack-sans-text";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    StackSansText_400Regular,
    StackSansText_500Medium,
    StackSansText_600SemiBold,
    StackSansText_700Bold,
    StackSansNotch_400Regular,
    StackSansNotch_500Medium,
    StackSansNotch_600SemiBold,
    StackSansNotch_700Bold,
  });
  const ready = loaded || Boolean(error);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return ready;
}
