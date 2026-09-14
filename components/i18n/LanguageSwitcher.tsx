// components/i18n/LanguageSwitcher.tsx
// Compact HU/EN language toggle for login, settings, and app chrome.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  APP_LANGUAGES,
  setAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/language";

type LanguageSwitcherProps = {
  tone?: "onDark" | "onLight";
  testID?: string;
};

export function LanguageSwitcher({
  tone = "onLight",
  testID = "language-switcher",
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const active = (i18n.language?.startsWith("en") ? "en" : "hu") as AppLanguage;
  const onDark = tone === "onDark";

  async function select(code: AppLanguage) {
    if (code === active) {
      return;
    }
    await setAppLanguage(code);
  }

  return (
    <HStack
      space="xs"
      className={`items-center rounded-lg border p-1 ${
        onDark ? "border-white/20 bg-white/5" : "border-border bg-muted/40"
      }`}
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={t("language.switcherLabel")}
    >
      {APP_LANGUAGES.map((language) => {
        const selected = language.code === active;
        return (
          <Pressable
            key={language.code}
            onPress={() => void select(language.code)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={language.label}
            testID={`${testID}-${language.code}`}
            hitSlop={8}
            className={`min-h-11 min-w-8 items-center justify-center rounded-md px-2.5 py-1.5 ${
              selected
                ? onDark
                  ? "bg-white"
                  : "bg-primary"
                : "bg-transparent"
            }`}
          >
            <Text
              size="xs"
              className={`font-semibold ${
                selected
                  ? onDark
                    ? "text-secondary"
                    : "text-primary-foreground"
                  : onDark
                    ? "text-white/75"
                    : "text-muted-foreground"
              }`}
            >
              {language.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
