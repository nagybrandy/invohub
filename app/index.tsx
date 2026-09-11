// app/index.tsx
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe,
  Headphones,
  Lock,
  Receipt,
  Send,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { CookieConsent } from "@/components/marketing/CookieConsent";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

function LandingNav({
  isDesktop,
  isSignedIn,
}: {
  isDesktop: boolean;
  isSignedIn: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Box className="bg-secondary px-4 py-4 md:px-10">
      <HStack className="items-center justify-between">
        <HStack space="sm" className="items-center">
          <Box className="h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Text className="text-sm font-bold text-white">IH</Text>
          </Box>
          <Text className="text-lg font-bold text-white">InvoHub</Text>
        </HStack>

        {isDesktop ? (
          <HStack space="xl" className="items-center">
            <Pressable accessibilityRole="link">
              <Text className="text-sm text-[#f9f9f9]">
                {t("landing.nav.features")}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="link">
              <Text className="text-sm text-[#f9f9f9]">
                {t("landing.nav.pricing")}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="link">
              <Text className="text-sm text-[#f9f9f9]">
                {t("landing.nav.contact")}
              </Text>
            </Pressable>
          </HStack>
        ) : null}

        <HStack space="sm">
          {isSignedIn ? (
            <Button
              size="sm"
              onPress={() => router.push(routes.dashboard)}
            >
              <ButtonText>{t("landing.goToDashboard")}</ButtonText>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push(routes.login)}
                className="border-[#f9f9f9]/30"
              >
                <ButtonText className="text-white">
                  {t("auth.signIn")}
                </ButtonText>
              </Button>
              <Button
                size="sm"
                onPress={() => router.push(routes.login)}
              >
                <ButtonText>{t("landing.getStarted")}</ButtonText>
              </Button>
            </>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}

function HeroSection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session);

  const highlights = [
    t("landing.hero.highlight1"),
    t("landing.hero.highlight2"),
    t("landing.hero.highlight3"),
  ];

  return (
    <Box className="bg-secondary px-4 pb-16 pt-12 md:px-10 md:pb-24 md:pt-20">
      <Box className="mx-auto max-w-4xl items-center">
        <VStack space="lg" className="items-center">
          <Box className="rounded-full bg-primary/20 px-4 py-1.5">
            <Text className="text-xs font-medium text-primary">
              {t("landing.hero.badge")}
            </Text>
          </Box>

          <Heading
            size={isDesktop ? "3xl" : "2xl"}
            className="max-w-2xl text-center text-white"
          >
            {t("landing.hero.title")}
          </Heading>

          <Text
            size="md"
            className="max-w-lg text-center font-light text-[#c5c7ca]"
          >
            {t("landing.hero.subtitle")}
          </Text>

          <HStack space="sm" className="pt-2">
            <Button
              size="lg"
              onPress={() =>
                router.push(isSignedIn ? routes.dashboard : routes.login)
              }
            >
              <ButtonText>
                {isSignedIn
                  ? t("landing.goToDashboard")
                  : t("landing.getStartedFree")}
              </ButtonText>
              <ArrowRight size={18} color="#ffffff" />
            </Button>
          </HStack>

          <VStack space="sm" className="items-center pt-4">
            {highlights.map((text) => (
              <HStack key={text} space="sm" className="items-center">
                <CheckCircle2 size={16} color="#8db600" />
                <Text size="sm" className="font-light text-[#c5c7ca]">
                  {text}
                </Text>
              </HStack>
            ))}
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
}

type FeatureItem = {
  icon: typeof FileText;
  titleKey: string;
  descKey: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: FileText,
    titleKey: "landing.features.invoicing.title",
    descKey: "landing.features.invoicing.desc",
  },
  {
    icon: Receipt,
    titleKey: "landing.features.receipts.title",
    descKey: "landing.features.receipts.desc",
  },
  {
    icon: Shield,
    titleKey: "landing.features.nav.title",
    descKey: "landing.features.nav.desc",
  },
  {
    icon: Globe,
    titleKey: "landing.features.multiCurrency.title",
    descKey: "landing.features.multiCurrency.desc",
  },
  {
    icon: BarChart3,
    titleKey: "landing.features.dashboard.title",
    descKey: "landing.features.dashboard.desc",
  },
  {
    icon: Smartphone,
    titleKey: "landing.features.crossPlatform.title",
    descKey: "landing.features.crossPlatform.desc",
  },
];

function FeaturesSection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Box className="px-4 py-16 md:px-10 md:py-24">
      <Box className="mx-auto max-w-5xl">
        <VStack space="lg" className="items-center pb-12">
          <Text className="text-sm font-medium uppercase tracking-wider text-primary">
            {t("landing.features.sectionLabel")}
          </Text>
          <Heading size="2xl" className="max-w-lg text-center text-foreground">
            {t("landing.features.sectionTitle")}
          </Heading>
          <Text
            size="md"
            className="max-w-md text-center font-light text-muted-foreground"
          >
            {t("landing.features.sectionSubtitle")}
          </Text>
        </VStack>

        <Box
          className={
            isDesktop
              ? "flex-row flex-wrap justify-center gap-6"
              : "gap-4"
          }
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.titleKey}
                className={`p-6 ${isDesktop ? "w-[calc(33.333%-16px)]" : ""}`}
              >
                <VStack space="md">
                  <Box className="h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Icon size={22} color={icons.primary} />
                  </Box>
                  <Text className="text-base font-semibold text-foreground">
                    {t(feature.titleKey)}
                  </Text>
                  <Text size="sm" className="font-light text-muted-foreground">
                    {t(feature.descKey)}
                  </Text>
                </VStack>
              </Card>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

type StepItem = {
  step: string;
  icon: typeof Zap;
  titleKey: string;
  descKey: string;
};

const STEPS: StepItem[] = [
  {
    step: "1",
    icon: Zap,
    titleKey: "landing.howItWorks.step1.title",
    descKey: "landing.howItWorks.step1.desc",
  },
  {
    step: "2",
    icon: CreditCard,
    titleKey: "landing.howItWorks.step2.title",
    descKey: "landing.howItWorks.step2.desc",
  },
  {
    step: "3",
    icon: Send,
    titleKey: "landing.howItWorks.step3.title",
    descKey: "landing.howItWorks.step3.desc",
  },
];

function HowItWorksSection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Box className="bg-muted px-4 py-16 md:px-10 md:py-24">
      <Box className="mx-auto max-w-5xl">
        <VStack space="lg" className="items-center pb-12">
          <Text className="text-sm font-medium uppercase tracking-wider text-primary">
            {t("landing.howItWorks.sectionLabel")}
          </Text>
          <Heading size="2xl" className="text-center text-foreground">
            {t("landing.howItWorks.sectionTitle")}
          </Heading>
        </VStack>

        <Box
          className={
            isDesktop ? "flex-row justify-center gap-8" : "gap-6"
          }
        >
          {STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.step}
                className={`items-center p-8 ${isDesktop ? "flex-1" : ""}`}
              >
                <VStack space="md" className="items-center">
                  <Box className="h-12 w-12 items-center justify-center rounded-full bg-primary">
                    <Text className="text-lg font-bold text-white">
                      {item.step}
                    </Text>
                  </Box>
                  <Icon size={28} color={icons.primary} />
                  <Text className="text-center text-base font-semibold text-foreground">
                    {t(item.titleKey)}
                  </Text>
                  <Text
                    size="sm"
                    className="text-center font-light text-muted-foreground"
                  >
                    {t(item.descKey)}
                  </Text>
                </VStack>
              </Card>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function StatsSection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();

  const stats = [
    { value: "NAV", labelKey: "landing.stats.navCompliant" },
    { value: "3", labelKey: "landing.stats.platforms" },
    { value: "< 2 perc", labelKey: "landing.stats.invoiceTime" },
    { value: "0 Ft", labelKey: "landing.stats.startPrice" },
  ];

  return (
    <Box className="px-4 py-16 md:px-10 md:py-20">
      <Box className="mx-auto max-w-4xl">
        <Box
          className={
            isDesktop
              ? "flex-row justify-between gap-8"
              : "flex-row flex-wrap justify-center gap-6"
          }
        >
          {stats.map((stat) => (
            <VStack
              key={stat.labelKey}
              space="xs"
              className="items-center px-4 py-2"
            >
              <Text className="text-3xl font-bold text-primary">
                {stat.value}
              </Text>
              <Text
                size="sm"
                className="text-center font-light text-muted-foreground"
              >
                {t(stat.labelKey)}
              </Text>
            </VStack>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function CtaSection() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session);

  return (
    <Box className="bg-secondary px-4 py-16 md:px-10 md:py-24">
      <Box className="mx-auto max-w-2xl items-center">
        <VStack space="lg" className="items-center">
          <Heading size="2xl" className="text-center text-white">
            {t("landing.cta.title")}
          </Heading>
          <Text
            size="md"
            className="max-w-md text-center font-light text-[#c5c7ca]"
          >
            {t("landing.cta.subtitle")}
          </Text>
          <HStack space="sm" className="pt-2">
            <Button
              size="lg"
              onPress={() =>
                router.push(isSignedIn ? routes.dashboard : routes.login)
              }
            >
              <ButtonText>
                {isSignedIn
                  ? t("landing.goToDashboard")
                  : t("landing.getStartedFree")}
              </ButtonText>
              <ArrowRight size={18} color="#ffffff" />
            </Button>
          </HStack>
          <HStack space="lg" className="pt-4">
            <HStack space="xs" className="items-center">
              <Lock size={14} color="#8db600" />
              <Text size="xs" className="font-light text-[#c5c7ca]">
                {t("landing.cta.secure")}
              </Text>
            </HStack>
            <HStack space="xs" className="items-center">
              <Headphones size={14} color="#8db600" />
              <Text size="xs" className="font-light text-[#c5c7ca]">
                {t("landing.cta.support")}
              </Text>
            </HStack>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}

function Footer() {
  const { t } = useTranslation();

  return (
    <Box className="border-t border-border bg-card px-4 py-8 md:px-10">
      <Box className="mx-auto max-w-5xl">
        <Box className="gap-5 md:flex-row md:items-center md:justify-between">
          <HStack space="sm" className="items-center">
            <Box className="h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Text className="text-xs font-bold text-white">IH</Text>
            </Box>
            <Text size="sm" className="font-medium text-foreground">
              InvoHub
            </Text>
          </HStack>
          <HStack space="md" className="flex-wrap">
            {([
              [routes.terms, "landing.footer.terms"],
              [routes.privacy, "landing.footer.privacy"],
              [routes.cookies, "landing.footer.cookies"],
              [routes.imprint, "landing.footer.imprint"],
            ] as const).map(([href, labelKey]) => (
              <Pressable
                key={String(href)}
                accessibilityRole="link"
                onPress={() => router.push(href)}
              >
                <Text size="xs" className="font-medium text-primary">
                  {t(String(labelKey))}
                </Text>
              </Pressable>
            ))}
          </HStack>
          <Text size="xs" className="font-light text-muted-foreground">
            {t("landing.footer.copyright", {
              year: new Date().getFullYear(),
            })}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

export default function Landing() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { data: session } = useSession();
  const isSignedIn = Boolean(session);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1" bounces={false}>
        <LandingNav isDesktop={isDesktop} isSignedIn={isSignedIn} />
        <HeroSection isDesktop={isDesktop} />
        <FeaturesSection isDesktop={isDesktop} />
        <StatsSection isDesktop={isDesktop} />
        <HowItWorksSection isDesktop={isDesktop} />
        <CtaSection />
        <Footer />
      </ScrollView>
      <CookieConsent onOpenPolicy={() => router.push(routes.cookies)} />
    </SafeAreaView>
  );
}
