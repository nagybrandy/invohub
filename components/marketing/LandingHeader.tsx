// components/marketing/LandingHeader.tsx
// Responsive landing header with sticky navigation and an accessible mobile menu.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react-native";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { landingColors } from "@/components/marketing/landing-theme";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export type LandingSectionId = "product" | "capabilities" | "workflow" | "roadmap";

type LandingHeaderProps = {
  isDesktop: boolean;
  isSignedIn: boolean;
  onNavigate: (section: LandingSectionId) => void;
  onLogin: () => void;
  onPrimaryAction: () => void;
};

/** @deprecated Prefer BrandLogo — alias kept for existing section imports. */
export function BrandMark({ dark = false }: { dark?: boolean }) {
  return <BrandLogo tone={dark ? "onLight" : "onDark"} height={36} />;
}

export function LandingHeader({
  isDesktop,
  isSignedIn,
  onNavigate,
  onLogin,
  onPrimaryAction,
}: LandingHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navItems: Array<[LandingSectionId, string]> = [
    ["product", t("landing.nav.product")],
    ["capabilities", t("landing.nav.capabilities")],
    ["workflow", t("landing.nav.workflow")],
    ["roadmap", t("landing.nav.roadmap")],
  ];

  function navigate(section: LandingSectionId) {
    setMenuOpen(false);
    onNavigate(section);
  }

  return (
    <Box
      testID="landing-header"
      className="z-40 border-b border-white/10 bg-secondary px-4 py-3 web:sticky web:top-0 md:px-8"
    >
      <HStack className="mx-auto w-full max-w-[1280px] items-center justify-between">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("landing.nav.home")}
          onPress={() => navigate("product")}
          className="rounded-lg web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
          testID="landing-brand-logo"
        >
          <BrandLogo tone="onDark" height={36} />
        </Pressable>

        {isDesktop ? (
          <HStack space="xl" className="items-center">
            {navItems.map(([section, label]) => (
              <Pressable
                key={section}
                accessibilityRole="link"
                onPress={() => navigate(section)}
                className="rounded-md px-1 py-2 web:transition-colors web:hover:opacity-80 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              >
                <Text size="sm" className="font-medium text-[#e4e9f4]">
                  {label}
                </Text>
              </Pressable>
            ))}
          </HStack>
        ) : null}

        <HStack space="sm" className="items-center">
          {isDesktop && !isSignedIn ? (
            <Button variant="ghost" size="sm" onPress={onLogin} testID="landing-login">
              <ButtonText className="text-white">{t("auth.signIn")}</ButtonText>
            </Button>
          ) : null}
          <Button
            size="sm"
            accessibilityLabel={isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
            testID="landing-header-cta"
            onPress={onPrimaryAction}
          >
            <ButtonText>
              {isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
            </ButtonText>
          </Button>
          {!isDesktop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? t("landing.nav.closeMenu") : t("landing.nav.openMenu")}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((current) => !current)}
              className="h-11 w-11 items-center justify-center rounded-lg border border-white/20 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              testID="landing-menu-toggle"
            >
              {menuOpen ? (
                <X size={20} color={landingColors.white} />
              ) : (
                <Menu size={20} color={landingColors.white} />
              )}
            </Pressable>
          ) : null}
        </HStack>
      </HStack>

      {!isDesktop && menuOpen ? (
        <Box
          testID="landing-mobile-menu"
          className="mx-auto mt-3 w-full max-w-[1280px] border-t border-white/10 pt-3"
        >
          <VStack space="xs">
            {navItems.map(([section, label]) => (
              <Pressable
                key={section}
                accessibilityRole="link"
                onPress={() => navigate(section)}
                className="min-h-11 justify-center rounded-lg px-3 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              >
                <Text className="font-medium text-white">{label}</Text>
              </Pressable>
            ))}
            {!isSignedIn ? (
              <Pressable
                accessibilityRole="link"
                onPress={onLogin}
                className="min-h-11 justify-center rounded-lg px-3 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              >
                <Text className="font-medium text-white">{t("auth.signIn")}</Text>
              </Pressable>
            ) : null}
          </VStack>
        </Box>
      ) : null}
    </Box>
  );
}
