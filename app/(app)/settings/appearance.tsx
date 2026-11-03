// app/(app)/settings/appearance.tsx
// Nyelv és megjelenés: the interface language (dropdown with native names)
// and the theme as three cards. Világos / Sötét / Rendszer szerint write
// light / dark / system through useColorScheme().setTheme: an explicit choice
// sets <html data-theme>, "system" removes it (SPEC §1.3). Both choices are
// remembered on this device.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { SettingsPage, SettingsSection, SettingsSheet } from "@/components/settings/SettingsSheet";
import { ThemeCards } from "@/components/settings/ThemeCards";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { useColorScheme } from "@/lib/useColorScheme";

export default function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const { preference, setTheme } = useColorScheme();
  const keys = settingsItemKeys("appearance");

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-appearance">
      <SettingsSheet>
        <SettingsSection title={t("language.title")} hint={t("settingsPages.appearance.languageHint")}>
          <LanguageSwitcher className="w-full" testID="appearance-language" />
        </SettingsSection>
        <SettingsSection
          title={t("settingsPages.appearance.themeTitle")}
          hint={t("settingsPages.appearance.themeHint")}
        >
          <ThemeCards
            testID="theme-cards"
            accessibilityLabel={t("settingsPages.appearance.themeLabel")}
            value={preference}
            onChange={(next) => void setTheme(next)}
            options={[
              { value: "light", label: t("settingsPages.appearance.themes.light") },
              { value: "dark", label: t("settingsPages.appearance.themes.dark") },
              { value: "system", label: t("settingsPages.appearance.themes.system") },
            ]}
          />
        </SettingsSection>
      </SettingsSheet>
    </SettingsPage>
  );
}
