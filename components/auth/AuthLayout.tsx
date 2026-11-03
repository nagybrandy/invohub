// components/auth/AuthLayout.tsx
// Shared shell of the signed-out account screens (login, forgot / reset
// password, invite). Redesign 2026-11 (SPEC §10.1):
//  - from 900px: a navy hero panel (44%, min 480) with logo, title, subtitle,
//    the EV note pill, the language dropdown and the back link, and a 440px
//    form card centred on the canvas;
//  - below: logo + language row, the title and subtitle, then a full-width card.
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { BrandTexture } from "@/components/marketing/BrandTexture";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { routes } from "@/lib/navigation";
import { type } from "@/lib/ui/type";
import { useHydrated } from "@/lib/useHydrated";

/** Width from which the navy hero panel sits beside the card. */
export const AUTH_SPLIT_MIN_WIDTH = 900;

export type AuthVariant = "split" | "stacked";

/**
 * Viewport-dependent markup only after hydration: the server renders with
 * width 0 (the stacked layout), and a desktop client must start from the same
 * HTML or React discards the pre-rendered page (error #418).
 */
export function resolveAuthVariant(width: number, hydrated: boolean): AuthVariant {
  return hydrated && width >= AUTH_SPLIT_MIN_WIDTH ? "split" : "stacked";
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const variant = resolveAuthVariant(width, hydrated);
  const goHome = React.useCallback(() => router.push(routes.home), []);

  if (variant === "split") {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]} testID="auth-layout">
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow flex-row"
          keyboardShouldPersistTaps="handled"
        >
          <Box
            testID="auth-hero-panel"
            className="on-navy relative w-[44%] min-w-[480px] shrink-0 justify-between overflow-hidden bg-navy px-12 py-12"
          >
            <BrandTexture
              variant="mark"
              tone="onDark"
              size={420}
              rotate={12}
              opacity={0.07}
              className="-bottom-24 -right-24"
              testID="auth-hero-texture"
            />
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("landing.nav.home")}
              onPress={goHome}
              className="relative self-start rounded-control"
              testID="auth-logo"
            >
              <BrandLogo tone="onDark" height={38} />
            </Pressable>

            <VStack space="md" className="relative max-w-[440px] self-start">
              <Heading
                size="3xl"
                className="font-heading text-[36px] font-bold leading-[1.1] tracking-[-0.01em] text-white"
              >
                {t("auth.heroTitle")}
              </Heading>
              <Text className="text-base leading-6 text-navy-ink">{t("auth.heroSubtitle")}</Text>
              <Box className="mt-1 self-start rounded-full bg-white/10 px-3.5 py-1.5">
                <Text className="text-[13px] font-semibold text-white">{t("auth.evPriorityNote")}</Text>
              </Box>
            </VStack>

            <HStack className="relative flex-wrap items-center gap-x-6 gap-y-3">
              <Box className="w-[160px]">
                <LanguageSwitcher tone="onDark" testID="auth-language-switcher" className="w-full" />
              </Box>
              <Pressable
                accessibilityRole="link"
                onPress={goHome}
                className="rounded-control py-2 web:hover:underline"
                testID="auth-back-home"
              >
                <Text className="text-sm text-navy-ink">{t("auth.backToHome")}</Text>
              </Pressable>
            </HStack>
          </Box>

          <Box className="min-w-0 flex-1 items-center justify-center px-10 py-12">
            <Box
              testID="auth-card"
              className="w-full max-w-[440px] rounded-dialog bg-surface p-8 shadow-card"
            >
              {children}
            </Box>
          </Box>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]} testID="auth-layout">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center px-4 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <Box className="w-full max-w-[440px]">
          <HStack testID="auth-stacked-top" className="h-14 items-center justify-between">
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("landing.nav.home")}
              onPress={goHome}
              className="rounded-control"
              testID="auth-logo"
            >
              <BrandLogo tone="onLight" height={36} />
            </Pressable>
            <Box className="w-[132px]">
              <LanguageSwitcher tone="onLight" testID="auth-language-switcher" className="w-full" />
            </Box>
          </HStack>

          <VStack space="xs" className="pb-5 pt-3">
            <Heading size="3xl" className={type.pageTitle}>
              {t("auth.heroTitle")}
            </Heading>
            <Text className={type.lead}>{t("auth.heroSubtitle")}</Text>
          </VStack>

          <Box
            testID="auth-card"
            className="w-full rounded-card bg-surface p-5 shadow-card tab:rounded-dialog tab:p-8"
          >
            {children}
          </Box>

          <Pressable
            accessibilityRole="link"
            onPress={goHome}
            className="mt-4 min-h-10 items-center justify-center rounded-control"
            testID="auth-back-home"
          >
            <Text className="text-sm font-medium text-primary">{t("auth.backToHome")}</Text>
          </Pressable>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Title (26, 22 on phones) and subtitle at the top of the card. */
export function AuthCardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <VStack space="xs">
      <Heading size="2xl" className={type.pageTitle}>
        {title}
      </Heading>
      {subtitle ? <Text className="text-sm text-muted-ink">{subtitle}</Text> : null}
    </VStack>
  );
}

const NOTE_TONES = {
  ok: { box: "bg-ok-wash", text: "text-ok" },
  err: { box: "bg-err-wash", text: "text-err" },
  info: { box: "bg-primary-wash", text: "text-primary-ink" },
} as const;

/** ok-wash / err-wash / primary-wash note inside the card. */
export function AuthNote({
  tone,
  children,
  testID,
}: {
  tone: keyof typeof NOTE_TONES;
  children: React.ReactNode;
  testID?: string;
}) {
  const classes = NOTE_TONES[tone];
  return (
    <Box
      testID={testID}
      accessibilityRole={tone === "err" ? "alert" : undefined}
      className={`rounded-control px-3.5 py-2.5 ${classes.box}`}
    >
      <Text className={`text-sm ${classes.text}`}>{children}</Text>
    </Box>
  );
}
