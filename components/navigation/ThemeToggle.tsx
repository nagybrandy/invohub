// components/navigation/ThemeToggle.tsx
// One-tap light/dark switch. Redesign 2026-11: no longer rendered in the app
// chrome (the top bar is search + bell only; theme lives in Settings > Nyelv
// és megjelenés), but it keeps working: it always writes an EXPLICIT
// light/dark preference, which sets <html data-theme> and so beats the OS
// setting (lib/useColorScheme.tsx). Choosing "system" is done from Settings.
import { Moon, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "@/components/ui/pressable";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_ICON_BOX } from "@/lib/ui/tap-target";
import { useColorScheme } from "@/lib/useColorScheme";

export type ThemeToggleProps = {
  /** Icon colour: "onLight" for light surfaces, "onDark" for the navy sidebar. */
  tone: "onLight" | "onDark";
  testID?: string;
};

export function ThemeToggle({ tone, testID = "theme-toggle" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { isDarkColorScheme, toggleTheme } = useColorScheme();
  const color = tone === "onDark" ? icons.onNavyActive : icons.muted;
  const Icon = isDarkColorScheme ? Sun : Moon;

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={t(isDarkColorScheme ? "nav.switchToLight" : "nav.switchToDark")}
      className={`rounded-full data-[hover=true]:bg-neutral-wash ${TAP_TARGET_ICON_BOX}`}
      testID={testID}
    >
      <Icon size={20} color={color} />
    </Pressable>
  );
}
