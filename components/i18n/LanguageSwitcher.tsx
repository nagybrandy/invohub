// components/i18n/LanguageSwitcher.tsx
// Language dropdown with native names (Magyar, English) — redesign 2026-11:
// the HU/EN pill toggle became a dropdown (BRIEF: "Use a dropdown for
// language"). Used by Settings > Nyelv és megjelenés and the public pages;
// the app chrome no longer carries it.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui/select";
import {
  APP_LANGUAGES,
  setAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/language";

type LanguageSwitcherProps = {
  /** `onDark` renders the field for a navy surface (auth panel, landing hero). */
  tone?: "onDark" | "onLight";
  testID?: string;
  className?: string;
};

export const LANGUAGE_OPTIONS = APP_LANGUAGES.map((language) => ({
  value: language.code,
  label: language.label,
}));

export function LanguageSwitcher({
  tone = "onLight",
  testID = "language-switcher",
  className = "w-[160px]",
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const active = (i18n.language?.startsWith("en") ? "en" : "hu") as AppLanguage;

  async function select(code: AppLanguage) {
    if (code === active) return;
    await setAppLanguage(code);
  }

  return (
    <Select<AppLanguage>
      testID={testID}
      value={active}
      options={LANGUAGE_OPTIONS}
      onChange={(code) => void select(code)}
      accessibilityLabel={t("language.switcherLabel")}
      tone={tone === "onDark" ? "onNavy" : "default"}
      className={className}
    />
  );
}
