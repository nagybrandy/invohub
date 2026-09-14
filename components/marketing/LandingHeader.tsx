// components/marketing/LandingHeader.tsx
// Floating landing header: transparent over the hero, solid after scroll / menu open.
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react-native";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { landingColors } from "@/components/marketing/landing-theme";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export type LandingSectionId = "product" | "capabilities" | "workflow" | "roadmap" | "insights";

type LandingHeaderProps = {
  isDesktop: boolean;
  isSignedIn: boolean;
  onNavigate: (section: LandingSectionId) => void;
  onLogin: () => void;
  onPrimaryAction: () => void;
  onOpenBlog: () => void;
  /**
   * Keep the pill chrome solid instead of transparent-over-hero. Screens with
   * no dark hero behind the header (e.g. the blog) need this so header text
   * stays legible at scroll position 0.
   */
  forceSolid?: boolean;
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
  onOpenBlog,
  forceSolid = false,
}: LandingHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [solid, setSolid] = React.useState(false);
  const navItems: Array<[LandingSectionId, string]> = [
    ["product", t("landing.nav.product")],
    ["capabilities", t("landing.nav.capabilities")],
    ["workflow", t("landing.nav.workflow")],
    ["roadmap", t("landing.nav.roadmap")],
  ];

  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const onScroll = () => {
      setSolid(window.scrollY > 18);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock background scroll while the fullscreen mobile menu is open so the
  // page behind it can't be dragged around underneath the overlay.
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    if (!menuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function navigate(section: LandingSectionId) {
    setMenuOpen(false);
    onNavigate(section);
  }

  const chromeSolid = forceSolid || solid || menuOpen;

  return (
    <>
      <Box
        testID="landing-header"
        className={
          !isDesktop && menuOpen
            ? // Flush with the fullscreen menu below it while open — no
              // floating pill (rounded corners/border/top margin) sitting on
              // top, so header + menu read as one continuous surface.
              "z-50 w-full border-transparent bg-secondary px-3 py-2 web:fixed web:left-0 web:top-0"
            : `z-50 px-3 py-2 web:fixed web:left-1/2 web:top-3 web:w-[min(1180px,calc(100%-24px))] web:-translate-x-1/2 web:rounded-2xl web:border web:transition-[background-color,border-color,box-shadow,backdrop-filter] web:duration-200 md:px-5 ${
                chromeSolid
                  ? "border-white/12 bg-secondary/90 web:shadow-lg web:backdrop-blur-md"
                  : "border-transparent bg-transparent"
              }`
        }
      >
        <HStack className="mx-auto w-full max-w-[1280px] items-center justify-between">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("landing.nav.home")}
          onPress={() => navigate("product")}
          className="rounded-lg web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
          testID="landing-brand-logo"
        >
          <BrandLogo tone="onDark" height={46} />
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
            <Pressable
              accessibilityRole="link"
              onPress={onOpenBlog}
              className="rounded-md px-1 py-2 web:transition-colors web:hover:opacity-80 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              testID="landing-nav-blog"
            >
              <Text size="sm" className="font-medium text-[#e4e9f4]">
                {t("landing.nav.blog")}
              </Text>
            </Pressable>
          </HStack>
        ) : null}

        <HStack className="items-center gap-2.5">
          {/*
            Mobile keeps the top bar to just brand + hamburger — the CTA and
            language switch live inside the fullscreen menu instead, not
            crowded up here.
          */}
          {isDesktop ? (
            <>
              {!isSignedIn ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onPress={onLogin}
                  testID="landing-login"
                >
                  <ButtonText className="text-white">{t("auth.signIn")}</ButtonText>
                </Button>
              ) : null}
              <Button
                size="sm"
                className="min-h-11"
                accessibilityLabel={isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
                testID="landing-header-cta"
                onPress={onPrimaryAction}
              >
                <ButtonText>
                  {isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
                </ButtonText>
              </Button>
              <LanguageSwitcher tone="onDark" testID="landing-language-switcher" />
            </>
          ) : (
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
          )}
        </HStack>
      </HStack>
      </Box>

      {/*
        Rendered as a SIBLING of the pill above, not nested inside it: the
        pill has a `translate-x-1/2` transform, which on web establishes a
        new containing block for any `position: fixed` descendant — a fixed
        overlay nested inside it would be clipped to the pill's own small
        box instead of covering the viewport. Sitting outside it, this menu
        is a true fullsccreen overlay. z-40 keeps it below the z-50 pill, so
        the brand mark and the (still-visible) close/X toggle stay on top.
      */}
      {!isDesktop && menuOpen ? (
        <Box
          testID="landing-mobile-menu"
          className="fixed inset-0 z-40 flex-col justify-end bg-secondary px-6 pb-8"
        >
          <VStack space="sm" className="mx-auto w-full max-w-[480px]">
            {navItems.map(([section, label]) => (
              <Pressable
                key={section}
                accessibilityRole="link"
                onPress={() => navigate(section)}
                className="min-h-14 justify-center rounded-lg px-3 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              >
                <Text size="xl" className="font-medium text-white">
                  {label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                setMenuOpen(false);
                onOpenBlog();
              }}
              className="min-h-14 justify-center rounded-lg px-3 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              testID="landing-mobile-blog"
            >
              <Text size="xl" className="font-medium text-white">
                {t("landing.nav.blog")}
              </Text>
            </Pressable>
            {!isSignedIn ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  setMenuOpen(false);
                  onLogin();
                }}
                className="min-h-14 justify-center rounded-lg px-3 web:hover:bg-white/10 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              >
                <Text size="xl" className="font-medium text-white">
                  {t("auth.signIn")}
                </Text>
              </Pressable>
            ) : null}

            {/* CTA + language switch live here instead of the top bar, which
                on mobile stays down to just brand + hamburger. Same row —
                CTA takes the remaining width, the switcher stays minimal. */}
            <HStack space="sm" className="mt-4 items-center border-t border-white/10 pt-6">
              <Button
                size="lg"
                className="min-h-14 flex-1"
                accessibilityLabel={isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
                testID="landing-mobile-cta"
                onPress={() => {
                  setMenuOpen(false);
                  onPrimaryAction();
                }}
              >
                <ButtonText>
                  {isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
                </ButtonText>
              </Button>
              <LanguageSwitcher
                tone="onDark"
                testID="landing-mobile-language-switcher"
              />
            </HStack>
          </VStack>
        </Box>
      ) : null}
    </>
  );
}
