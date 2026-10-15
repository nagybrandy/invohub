// components/navigation/ThemeToggle.tsx
// One-tap light/dark switch for the app chrome (top strip, mobile header).
// The three-way "system / light / dark" tile stays in Settings; this is the
// quick flip people look for first — it used to exist only down there.
import { Moon, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "@/components/ui/pressable";
import { TAP_TARGET_ICON_BOX } from "@/lib/ui/tap-target";
import { useColorScheme } from "@/lib/useColorScheme";

export type ThemeToggleProps = {
  /** Icon colour: "onLight" for the desktop strip, "onDark" for the mobile header. */
  tone: "onLight" | "onDark";
  testID?: string;
};

export function ThemeToggle({ tone, testID = "theme-toggle" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { isDarkColorScheme, toggleTheme } = useColorScheme();
  const color = tone === "onDark" ? "#ffffff" : isDarkColorScheme ? "#cbd5e1" : "#64748b";
  const Icon = isDarkColorScheme ? Sun : Moon;

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={t(isDarkColorScheme ? "nav.switchToLight" : "nav.switchToDark")}
      className={`rounded-full hover:bg-muted ${TAP_TARGET_ICON_BOX}`}
      testID={testID}
    >
      <Icon size={20} color={color} />
    </Pressable>
  );
}
