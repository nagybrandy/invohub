// components/marketing/LandingHeader.tsx
// The public header (SPEC §10.4): 64px, links + Bejelentkezés + Kezdés on
// desktop, logo + a menu button that opens a bottom sheet on phones. Over the
// landing hero it is a transparent overlay (white text on the navy band) and
// turns solid (surface + bottom line) once the page scrolls. Pages without a
// navy hero on top (blog, legal, receipt check) pass `forceSolid`: the bar then
// sits in the page flow, solid from the start.
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react-native";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { landingLayout } from "@/components/marketing/landing-theme";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

export type LandingSectionId = "product" | "capabilities" | "workflow" | "insights";

type LandingHeaderProps = {
  isDesktop: boolean;
  isSignedIn: boolean;
  onNavigate: (section: LandingSectionId) => void;
  onLogin: () => void;
  onPrimaryAction: () => void;
  onOpenBlog: () => void;
  /**
   * Solid, in-flow bar instead of the transparent overlay. Screens with no
   * navy hero behind the header (the blog, legal pages) need this so the bar
   * stays legible at scroll position 0.
   */
  forceSolid?: boolean;
};

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
  const icons = useIconColors();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const navItems: Array<[LandingSectionId, string]> = [
    ["product", t("landing.nav.product")],
    ["capabilities", t("landing.nav.capabilities")],
    ["workflow", t("landing.nav.workflow")],
  ];

  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A resize to the desktop layout must not leave a sheet open behind it.
  React.useEffect(() => {
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  const solid = forceSolid || scrolled;
  const overHero = !solid;
  const ctaLabel = isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted");

  function navigate(section: LandingSectionId) {
    setMenuOpen(false);
    onNavigate(section);
  }

  function closeThen(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const linkText = overHero
    ? "text-navy-ink web:hover:text-white"
    : "text-ink web:hover:text-primary";
  const linkClass =
    "min-h-10 justify-center rounded-control px-1 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary";

  const barClass = [
    "z-50 h-16 w-full justify-center border-b web:transition-[background-color,border-color] web:duration-150 motion-reduce:web:transition-none",
    forceSolid ? "" : "web:fixed web:inset-x-0 web:top-0",
    solid
      ? "border-line bg-surface"
      : "border-transparent bg-navy web:bg-transparent",
    overHero ? "on-navy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Box testID="landing-header" className={barClass}>
        <HStack className={`${landingLayout.container} h-16 items-center justify-between`}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("landing.nav.home")}
            onPress={() => navigate("product")}
            className="rounded-control web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
            testID="landing-brand-logo"
          >
            <BrandLogo tone={overHero ? "onDark" : "onLight"} height={36} />
          </Pressable>

          {isDesktop ? (
            <HStack className="items-center gap-7">
              {navItems.map(([section, label]) => (
                <Pressable
                  key={section}
                  accessibilityRole="link"
                  onPress={() => navigate(section)}
                  className={linkClass}
                  testID={`landing-nav-${section}`}
                >
                  <Text className={`text-sm font-medium ${linkText}`}>{label}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="link"
                onPress={onOpenBlog}
                className={linkClass}
                testID="landing-nav-blog"
              >
                <Text className={`text-sm font-medium ${linkText}`}>{t("landing.nav.blog")}</Text>
              </Pressable>
            </HStack>
          ) : null}

          {isDesktop ? (
            <HStack className="items-center gap-2">
              {!isSignedIn ? (
                <Button
                  variant="tertiary"
                  size="md"
                  className={overHero ? "data-[hover=true]:bg-white/10 data-[active=true]:bg-white/10" : ""}
                  onPress={onLogin}
                  testID="landing-login"
                >
                  <ButtonText className={overHero ? "text-white" : ""}>{t("auth.signIn")}</ButtonText>
                </Button>
              ) : null}
              <Button
                size="md"
                accessibilityLabel={ctaLabel}
                testID="landing-header-cta"
                onPress={onPrimaryAction}
              >
                <ButtonText>{ctaLabel}</ButtonText>
              </Button>
              <Box className="ml-1 w-[128px]">
                <LanguageSwitcher
                  tone={overHero ? "onDark" : "onLight"}
                  testID="landing-language-switcher"
                  className="w-full"
                />
              </Box>
            </HStack>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={menuOpen ? t("landing.nav.closeMenu") : t("landing.nav.openMenu")}
              accessibilityState={{ expanded: menuOpen }}
              onPress={() => setMenuOpen((current) => !current)}
              className={`h-10 w-10 items-center justify-center rounded-control border web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary ${
                overHero ? "border-white/[0.28]" : "border-line-strong"
              }`}
              testID="landing-menu-toggle"
            >
              <Menu size={20} color={overHero ? icons.onNavyActive : icons.foreground} />
            </Pressable>
          )}
        </HStack>
      </Box>

      {!isDesktop ? (
        <Sheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t("landing.hero.brand")}
          closeLabel={t("landing.nav.closeMenu")}
          presentation="sheet"
          testID="landing-mobile-menu"
        >
          <VStack className="pb-2">
            {navItems.map(([section, label]) => (
              <Pressable
                key={section}
                accessibilityRole="link"
                onPress={() => navigate(section)}
                className="min-h-[52px] justify-center border-b border-line px-1 web:hover:bg-wash2 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
                testID={`landing-mobile-link-${section}`}
              >
                <Text className="text-base font-medium text-ink">{label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="link"
              onPress={() => closeThen(onOpenBlog)}
              className="min-h-[52px] justify-center border-b border-line px-1 web:hover:bg-wash2 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
              testID="landing-mobile-blog"
            >
              <Text className="text-base font-medium text-ink">{t("landing.nav.blog")}</Text>
            </Pressable>

            <VStack className="gap-3 pt-5">
              {!isSignedIn ? (
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onPress={() => closeThen(onLogin)}
                  testID="landing-mobile-login"
                >
                  <ButtonText>{t("auth.signIn")}</ButtonText>
                </Button>
              ) : null}
              <Button
                size="lg"
                className="w-full"
                accessibilityLabel={ctaLabel}
                testID="landing-mobile-cta"
                onPress={() => closeThen(onPrimaryAction)}
              >
                <ButtonText>{ctaLabel}</ButtonText>
              </Button>
              <LanguageSwitcher
                tone="onLight"
                testID="landing-mobile-language-switcher"
                className="w-full"
              />
            </VStack>
          </VStack>
        </Sheet>
      ) : null}
    </>
  );
}
