// app/index.tsx
// Responsive public marketing page for the production-ready InvoHub foundation.
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  MonitorSmartphone,
  ReceiptText,
  Users,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CookieConsent } from "@/components/marketing/CookieConsent";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

const CORNFLOWER = "#6495ed";
const LIGHT_BLUE = "#d9e7ff";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <HStack space="sm" className="items-center">
      <Box
        className={`${compact ? "h-8 w-8" : "h-10 w-10"} items-center justify-center rounded-lg bg-primary`}
      >
        <FileText size={compact ? 17 : 20} color="#ffffff" />
      </Box>
      <Text className={`${compact ? "text-base" : "text-lg"} font-bold text-white`}>
        InvoHub
      </Text>
    </HStack>
  );
}

function LandingHeader({
  isDesktop,
  isSignedIn,
}: {
  isDesktop: boolean;
  isSignedIn: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Box className="bg-secondary px-4 py-4 md:px-10">
      <HStack className="mx-auto w-full max-w-[1200px] items-center justify-between">
        <BrandMark />
        {isDesktop ? (
          <HStack space="xl" className="items-center">
            <Text size="sm" className="text-[#e4e6e8]">
              {t("landing.nav.product")}
            </Text>
            <Text size="sm" className="text-[#e4e6e8]">
              {t("landing.nav.workflow")}
            </Text>
            <Text size="sm" className="text-[#e4e6e8]">
              {t("landing.nav.pricing")}
            </Text>
          </HStack>
        ) : null}
        <HStack space="sm" className="items-center">
          {isDesktop && !isSignedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push(routes.login)}
            >
              <ButtonText className="text-white">{t("auth.signIn")}</ButtonText>
            </Button>
          ) : null}
          <Button
            size="sm"
            accessibilityLabel={t("landing.getStarted")}
            testID="landing-header-cta"
            onPress={() =>
              router.push(isSignedIn ? routes.dashboard : routes.login)
            }
          >
            <ButtonText>
              {isSignedIn ? t("landing.goToDashboard") : t("landing.getStarted")}
            </ButtonText>
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}

function Hero({ isDesktop, isSignedIn }: { isDesktop: boolean; isSignedIn: boolean }) {
  const { t } = useTranslation();

  return (
    <Box className="bg-secondary px-4 pb-14 pt-8 md:px-10 md:pb-24 md:pt-16">
      <Box
        className={`mx-auto w-full max-w-[1200px] gap-10 ${
          isDesktop ? "flex-row items-center" : ""
        }`}
      >
        <VStack space="xl" className={isDesktop ? "w-[46%]" : ""}>
          <Box className="self-start rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5">
            <Text size="xs" className="font-medium text-[#d9e7ff]">
              {t("landing.hero.badge")}
            </Text>
          </Box>

          <VStack space="md">
            <Heading
              size={isDesktop ? "4xl" : "3xl"}
              className="max-w-[620px] leading-tight text-white"
            >
              {t("landing.hero.title")}
            </Heading>
            <Text
              size={isDesktop ? "lg" : "md"}
              className="max-w-[560px] font-light leading-7 text-[#c5c7ca]"
            >
              {t("landing.hero.subtitle")}
            </Text>
          </VStack>

          <Box className="gap-3 md:flex-row md:items-center">
            <Button
              size="lg"
              accessibilityLabel={t("landing.getStartedFree")}
              testID="landing-hero-cta"
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
            <Text size="xs" className="font-light text-[#c5c7ca]">
              {t("landing.hero.ctaNote")}
            </Text>
          </Box>

          <HStack space="lg" className="flex-wrap">
            {[t("landing.hero.highlight1"), t("landing.hero.highlight2")].map(
              (item) => (
                <HStack key={item} space="xs" className="items-center">
                  <Check size={15} color={CORNFLOWER} />
                  <Text size="sm" className="text-[#e4e6e8]">
                    {item}
                  </Text>
                </HStack>
              ),
            )}
          </HStack>
        </VStack>

        <ProductProof compact={!isDesktop} />
      </Box>
    </Box>
  );
}

function ProductProof({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const rows = [
    { name: "INV-2026-0142", partner: "Minta Stúdió Kft.", amount: "248 920 Ft" },
    { name: "INV-2026-0141", partner: "Kék Duna Bt.", amount: "86 400 Ft" },
    { name: "INV-2026-0140", partner: "Northwind Kft.", amount: "174 600 Ft" },
  ];

  return (
    <Card
      className={`${compact ? "w-full" : "w-[54%]"} overflow-hidden border-[#4675ca]/40 bg-[#f6f6f8] p-0 shadow-xl`}
    >
      <HStack className="items-center justify-between bg-[#1f305e] px-4 py-3">
        <HStack space="sm" className="items-center">
          <LayoutDashboard size={17} color={LIGHT_BLUE} />
          <Text size="sm" className="font-semibold text-white">
            {t("landing.proof.title")}
          </Text>
        </HStack>
        <Box className="rounded-full bg-primary/20 px-2 py-1">
          <Text className="text-[10px] font-medium text-[#d9e7ff]">
            {t("landing.proof.preview")}
          </Text>
        </Box>
      </HStack>

      <VStack space="md" className="p-4 md:p-5">
        <Box className={compact ? "gap-2" : "flex-row gap-3"}>
          {[
            [t("landing.proof.revenue"), "1 284 500 Ft"],
            [t("landing.proof.outstanding"), "335 320 Ft"],
            [t("landing.proof.drafts"), "4"],
          ].map(([label, value]) => (
            <Box
              key={label}
              className="flex-1 rounded-lg border border-[#e4e6e8] bg-white p-3"
            >
              <Text className="text-[10px] text-[#696a6e]">{label}</Text>
              <Text size="sm" className="mt-1 font-bold text-[#212325]">
                {value}
              </Text>
            </Box>
          ))}
        </Box>

        <Box className="overflow-hidden rounded-lg border border-[#e4e6e8] bg-white">
          <HStack className="border-b border-[#e4e6e8] px-3 py-2">
            <Text size="xs" className="flex-1 font-semibold text-[#323336]">
              {t("landing.proof.recent")}
            </Text>
            <Text size="xs" className="text-[#696a6e]">
              {t("landing.proof.amount")}
            </Text>
          </HStack>
          {rows.slice(0, compact ? 2 : 3).map((row) => (
            <HStack
              key={row.name}
              className="items-center border-b border-[#e4e6e8] px-3 py-3 last:border-b-0"
            >
              <VStack className="flex-1">
                <Text size="xs" className="font-semibold text-[#212325]">
                  {row.name}
                </Text>
                <Text className="text-[10px] text-[#696a6e]">{row.partner}</Text>
              </VStack>
              <Text size="xs" className="font-medium text-[#212325]">
                {row.amount}
              </Text>
            </HStack>
          ))}
        </Box>
      </VStack>
    </Card>
  );
}

const BENEFIT_ICONS = [ReceiptText, Users, MonitorSmartphone] as const;

function Benefits({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const benefits = [
    ["landing.benefits.invoice.title", "landing.benefits.invoice.description"],
    ["landing.benefits.records.title", "landing.benefits.records.description"],
    ["landing.benefits.devices.title", "landing.benefits.devices.description"],
  ] as const;

  return (
    <Box className="bg-background px-4 py-16 md:px-10 md:py-24">
      <Box className="mx-auto w-full max-w-[1120px]">
        <VStack space="md" className="mb-10 max-w-[620px] md:mb-14">
          <Text size="sm" className="font-semibold uppercase tracking-wider text-primary">
            {t("landing.benefits.eyebrow")}
          </Text>
          <Heading size="3xl">{t("landing.benefits.title")}</Heading>
          <Text className="font-light leading-7 text-muted-foreground">
            {t("landing.benefits.subtitle")}
          </Text>
        </VStack>

        <Box className={isDesktop ? "flex-row gap-5" : "gap-4"}>
          {benefits.map(([titleKey, descriptionKey], index) => {
            const Icon = BENEFIT_ICONS[index];
            return (
              <Card key={titleKey} className="flex-1 border-border/70 p-5 shadow-none md:p-6">
                <VStack space="md">
                  <Box className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon size={20} color={icons.primary} />
                  </Box>
                  <Text className="text-base font-semibold">{t(titleKey)}</Text>
                  <Text size="sm" className="font-light leading-6 text-muted-foreground">
                    {t(descriptionKey)}
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

function Workflow({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const steps = [
    ["01", "landing.workflow.step1.title", "landing.workflow.step1.description"],
    ["02", "landing.workflow.step2.title", "landing.workflow.step2.description"],
    ["03", "landing.workflow.step3.title", "landing.workflow.step3.description"],
  ] as const;

  return (
    <Box className="border-y border-border/70 bg-card px-4 py-16 md:px-10 md:py-24">
      <Box
        className={`mx-auto w-full max-w-[1120px] gap-10 ${
          isDesktop ? "flex-row items-start" : ""
        }`}
      >
        <VStack space="md" className={isDesktop ? "w-[34%]" : ""}>
          <Text size="sm" className="font-semibold uppercase tracking-wider text-primary">
            {t("landing.workflow.eyebrow")}
          </Text>
          <Heading size="3xl">{t("landing.workflow.title")}</Heading>
          <Text className="font-light leading-7 text-muted-foreground">
            {t("landing.workflow.subtitle")}
          </Text>
        </VStack>
        <VStack space="sm" className={isDesktop ? "flex-1" : ""}>
          {steps.map(([number, titleKey, descriptionKey]) => (
            <HStack
              key={number}
              className="items-start gap-4 rounded-xl border border-border/70 bg-background p-4 md:p-5"
            >
              <Box className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Text size="xs" className="font-bold text-white">{number}</Text>
              </Box>
              <VStack space="xs" className="flex-1">
                <Text className="font-semibold">{t(titleKey)}</Text>
                <Text size="sm" className="font-light leading-6 text-muted-foreground">
                  {t(descriptionKey)}
                </Text>
              </VStack>
              {isDesktop ? <ChevronRight size={18} color={icons.primary} /> : null}
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}

function PricingCta({ isSignedIn }: { isSignedIn: boolean }) {
  const { t } = useTranslation();

  return (
    <Box className="bg-background px-4 py-16 md:px-10 md:py-24">
      <Card className="mx-auto w-full max-w-[920px] overflow-hidden border-primary/30 bg-secondary p-0 shadow-lg">
        <Box className="gap-8 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <VStack space="md" className="max-w-[570px]">
            <Box className="self-start rounded-full bg-primary/15 px-3 py-1">
              <Text size="xs" className="font-semibold text-[#d9e7ff]">
                {t("landing.pricing.eyebrow")}
              </Text>
            </Box>
            <Heading size="2xl" className="text-white">
              {t("landing.pricing.title")}
            </Heading>
            <Text className="font-light leading-7 text-[#c5c7ca]">
              {t("landing.pricing.description")}
            </Text>
            <HStack space="sm" className="items-center">
              <LockKeyhole size={16} color={CORNFLOWER} />
              <Text size="xs" className="text-[#e4e6e8]">
                {t("landing.pricing.honestNote")}
              </Text>
            </HStack>
          </VStack>
          <Button
            size="lg"
            accessibilityLabel={t("landing.pricing.cta")}
            onPress={() =>
              router.push(isSignedIn ? routes.dashboard : routes.login)
            }
          >
            <ButtonText>
              {isSignedIn ? t("landing.goToDashboard") : t("landing.pricing.cta")}
            </ButtonText>
            <ArrowRight size={18} color="#ffffff" />
          </Button>
        </Box>
      </Card>
    </Box>
  );
}

function Footer() {
  const { t } = useTranslation();
  const links = [
    [routes.terms, "landing.footer.terms"],
    [routes.privacy, "landing.footer.privacy"],
    [routes.cookies, "landing.footer.cookies"],
    [routes.imprint, "landing.footer.imprint"],
  ] as const;

  return (
    <Box className="border-t border-[#1f305e] bg-secondary px-4 py-10 md:px-10">
      <Box className="mx-auto w-full max-w-[1120px] gap-7">
        <Box className="gap-5 md:flex-row md:items-center md:justify-between">
          <BrandMark compact />
          <HStack space="lg" className="flex-wrap">
            {links.map(([href, labelKey]) => (
              <Pressable
                key={String(href)}
                accessibilityRole="link"
                onPress={() => router.push(href)}
                className="rounded-md"
              >
                <Text size="xs" className="font-medium text-[#e4e6e8]">
                  {t(labelKey)}
                </Text>
              </Pressable>
            ))}
          </HStack>
        </Box>
        <Box className="h-px bg-[#1f305e]" />
        <HStack className="items-center justify-between">
          <Text size="xs" className="font-light text-[#a6a8ab]">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </Text>
          <HStack space="xs" className="items-center">
            <FileCheck2 size={14} color={CORNFLOWER} />
            <Text size="xs" className="font-light text-[#a6a8ab]">
              {t("landing.footer.draftNote")}
            </Text>
          </HStack>
        </HStack>
      </Box>
    </Box>
  );
}

export default function Landing() {
  const { width } = useWindowDimensions();
  const { data: session } = useSession();
  const isDesktop = width >= 768;
  const isSignedIn = Boolean(session);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1" bounces={false}>
        <LandingHeader isDesktop={isDesktop} isSignedIn={isSignedIn} />
        <Hero isDesktop={isDesktop} isSignedIn={isSignedIn} />
        <Benefits isDesktop={isDesktop} />
        <Workflow isDesktop={isDesktop} />
        <PricingCta isSignedIn={isSignedIn} />
        <Footer />
      </ScrollView>
      <CookieConsent onOpenPolicy={() => router.push(routes.cookies)} />
    </SafeAreaView>
  );
}
