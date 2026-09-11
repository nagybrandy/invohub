// components/marketing/LandingSections.tsx
// Premium landing sections covering positioning, capabilities, workflow, roadmap, and conversion.
import * as React from "react";
import type { LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Check,
  ChevronRight,
  FileOutput,
  FileText,
  Landmark,
  Mail,
  Package,
  ReceiptText,
  Send,
  Sparkles,
  Users,
} from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { type LandingSectionId } from "@/components/marketing/LandingHeader";
import {
  MarketingInfographic,
  bentoInfographic,
  workflowInfographic,
} from "@/components/marketing/MarketingInfographic";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { landingColors, landingDisplayType } from "@/components/marketing/landing-theme";
import { listBlogPosts } from "@/lib/blog";
import { routes } from "@/lib/navigation";

type SectionLayoutHandler = (section: LandingSectionId, event: LayoutChangeEvent) => void;

type LandingActionProps = {
  isDesktop: boolean;
  isSignedIn: boolean;
  onPrimaryAction: () => void;
  onProductTour: () => void;
};

type LandingHeroProps = LandingActionProps & {
  onOpenBlog: () => void;
};

export function LandingHero({
  isDesktop,
  isSignedIn,
  onPrimaryAction,
  onProductTour,
  onOpenBlog,
}: LandingHeroProps) {
  const { t } = useTranslation();

  return (
    <Box className="relative overflow-hidden bg-secondary px-4 pb-16 pt-10 md:px-8 md:pb-28 md:pt-20">
      <Box className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(100,149,237,0.28),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(217,231,255,0.16),transparent_36%),linear-gradient(160deg,#111f4a_0%,#1f305e_58%,#111f4a_100%)]" />
      <Box className="pointer-events-none absolute -right-10 top-4 h-72 w-72 rounded-full bg-primary/25 blur-3xl web:animate-pulse md:h-[28rem] md:w-[28rem]" />
      <Box className="pointer-events-none absolute -left-8 bottom-0 h-56 w-56 rounded-full bg-[#6495ed]/15 blur-2xl" />
      <Box
        className={`relative z-[1] mx-auto w-full max-w-[1280px] gap-10 ${
          isDesktop ? "flex-row items-center" : ""
        }`}
      >
        <VStack space="xl" className={`min-w-0 ${isDesktop ? "basis-[42%] flex-shrink" : ""}`}>
          <VStack space="sm">
            <Box testID="landing-hero-brand">
              <Text className="font-heading text-3xl font-bold tracking-tight text-white md:text-4xl">
                {t("landing.hero.brand")}
              </Text>
            </Box>
            <HStack space="sm" className="items-center">
              <Box className="h-px w-10 bg-primary" />
              <Text className={`${landingDisplayType.kicker} text-[#b9c9e8]`}>
                {t("landing.hero.eyebrow")}
              </Text>
            </HStack>
          </VStack>
          <VStack space="lg">
            <Heading
              className={`font-heading font-bold leading-[1.02] tracking-[-1.5px] text-white ${
                isDesktop ? landingDisplayType.heroDesktop : landingDisplayType.heroMobile
              }`}
            >
              {t("landing.hero.title")}
            </Heading>
            <Text
              className={`max-w-[570px] font-light leading-7 text-[#c8d2e6] ${
                isDesktop ? "text-lg" : "text-base"
              }`}
            >
              {t("landing.hero.subtitle")}
            </Text>
          </VStack>
          <Box className="gap-3 md:flex-row md:flex-wrap">
            <Button
              size="lg"
              className="w-full web:transition-transform web:duration-200 web:hover:scale-[1.02] md:w-auto"
              accessibilityLabel={
                isSignedIn ? t("landing.goToDashboard") : t("landing.getStartedFree")
              }
              testID="landing-hero-cta"
              onPress={onPrimaryAction}
            >
              <ButtonText>
                {isSignedIn ? t("landing.goToDashboard") : t("landing.getStartedFree")}
              </ButtonText>
              <ArrowRight size={18} color={landingColors.white} />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/30 bg-transparent md:w-auto"
              onPress={onProductTour}
              testID="landing-product-tour"
            >
              <ButtonText className="text-white">{t("landing.hero.productTour")}</ButtonText>
              <ChevronRight size={18} color={landingColors.white} />
            </Button>
            <Button
              size="lg"
              variant="link"
              className="w-full md:w-auto"
              onPress={onOpenBlog}
              testID="landing-hero-blog"
            >
              <ButtonText className="text-[#d9e7ff]">{t("landing.hero.readBlog")}</ButtonText>
              <BookOpen size={16} color={landingColors.paleBlue} />
            </Button>
          </Box>
          <HStack space="sm" className="items-start">
            <Check size={16} color={landingColors.cornflower} />
            <Text size="xs" className="max-w-[470px] leading-5 text-[#aebbd3]">
              {t("landing.hero.reassurance")}
            </Text>
          </HStack>
        </VStack>
        <VStack space="lg" className={`min-w-0 ${isDesktop ? "flex-1" : "w-full"}`}>
          <MarketingInfographic
            source={workflowInfographic}
            alt={t("landing.hero.infographicAlt")}
            testID="landing-hero-infographic"
            className="border-white/15 web:transition-transform web:duration-500 web:hover:scale-[1.01]"
          />
          {isDesktop ? <ProductShowcase compact={false} /> : null}
        </VStack>
      </Box>
      {!isDesktop ? (
        <Box className="relative z-[1] mx-auto mt-10 w-full max-w-[1280px]">
          <ProductShowcase compact />
        </Box>
      ) : null}
    </Box>
  );
}

export function ProductTransition({
  isDesktop,
  onLayout,
}: {
  isDesktop: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();

  return (
    <Box
      onLayout={(event) => onLayout("product", event)}
      testID="landing-section-product"
      className="bg-background px-4 py-16 md:px-8 md:py-28"
    >
      <Box
        className={`mx-auto w-full max-w-[1120px] gap-10 ${
          isDesktop ? "flex-row items-start justify-between" : ""
        }`}
      >
        <VStack className={isDesktop ? "w-[45%]" : ""} space="md">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-primary">
            {t("landing.transition.eyebrow")}
          </Text>
          <Heading className="text-3xl leading-tight tracking-tight text-secondary md:text-4xl">
            {t("landing.transition.title")}
          </Heading>
        </VStack>
        <VStack className={isDesktop ? "w-[46%]" : ""} space="lg">
          <Text className="text-base font-light leading-7 text-muted-foreground md:text-lg">
            {t("landing.transition.description")}
          </Text>
          <Box className="border-l-2 border-primary pl-5">
            <Text className="font-medium leading-7 text-secondary">
              {t("landing.transition.statement")}
            </Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}

const capabilityIcons = {
  invoice: FileText,
  delivery: Mail,
  records: Users,
  reminder: BellRing,
  receipt: ReceiptText,
} as const;

export function CapabilityBento({
  isDesktop,
  onLayout,
}: {
  isDesktop: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();

  return (
    <Box
      onLayout={(event) => onLayout("capabilities", event)}
      testID="landing-section-capabilities"
      className="overflow-x-hidden bg-[#edf2fa] px-4 py-16 md:px-8 md:py-24"
    >
      <Box className="mx-auto w-full max-w-[1120px] min-w-0">
        <VStack space="md" className="mb-10 max-w-[690px] md:mb-14">
          <Text className={`${landingDisplayType.kicker} text-primary`}>
            {t("landing.capabilities.eyebrow")}
          </Text>
          <Heading className={`${landingDisplayType.section} font-heading leading-tight tracking-tight text-secondary`}>
            {t("landing.capabilities.title")}
          </Heading>
          <Text className="font-light leading-7 text-muted-foreground">
            {t("landing.capabilities.subtitle")}
          </Text>
        </VStack>

        <MarketingInfographic
          source={bentoInfographic}
          alt={t("landing.capabilities.infographicAlt")}
          testID="landing-bento-infographic"
          className="mb-8 border-[#dce3ef] bg-white md:mb-12"
        />

        <Box className={`min-w-0 ${isDesktop ? "flex-row gap-4" : "gap-4"}`}>
          <CapabilityCard
            icon={capabilityIcons.invoice}
            title={t("landing.capabilities.invoice.title")}
            description={t("landing.capabilities.invoice.description")}
            className={isDesktop ? "min-h-[320px] min-w-0 flex-[1.4]" : ""}
            featured
          >
            <Box className="mt-5 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
              <HStack className="items-center justify-between border-b border-white/10 px-4 py-3">
                <Text size="xs" className="font-medium text-white">
                  {t("landing.capabilities.invoice.preview")}
                </Text>
                <Text size="xs" className="text-[#b9c9e8]">248 920 Ft</Text>
              </HStack>
              <HStack className="items-center justify-between px-4 py-3">
                <Text size="xs" className="text-[#dbe4f4]">Minta Stúdió Kft.</Text>
                <Box className="rounded-lg bg-[#e7f6ec] px-2 py-1">
                  <Text className="text-[10px] font-semibold text-[#166534]">
                    {t("landing.product.paid")}
                  </Text>
                </Box>
              </HStack>
            </Box>
          </CapabilityCard>

          <VStack className={isDesktop ? "min-w-0 flex-1" : ""} space="md">
            <CapabilityCard
              icon={capabilityIcons.delivery}
              title={t("landing.capabilities.delivery.title")}
              description={t("landing.capabilities.delivery.description")}
              className="min-w-0 flex-1"
            />
            <CapabilityCard
              icon={capabilityIcons.records}
              title={t("landing.capabilities.records.title")}
              description={t("landing.capabilities.records.description")}
              className="min-w-0 flex-1"
            />
          </VStack>
        </Box>

        <Box className={`mt-4 min-w-0 gap-4 ${isDesktop ? "flex-row" : ""}`}>
          <CapabilityCard
            icon={capabilityIcons.reminder}
            title={t("landing.capabilities.reminder.title")}
            description={t("landing.capabilities.reminder.description")}
            className="min-w-0 flex-1"
          />
          <CapabilityCard
            icon={capabilityIcons.receipt}
            title={t("landing.capabilities.receipt.title")}
            description={t("landing.capabilities.receipt.description")}
            className={isDesktop ? "min-w-0 flex-[1.4]" : "min-w-0"}
          />
        </Box>
      </Box>
    </Box>
  );
}

function CapabilityCard({
  icon: Icon,
  title,
  description,
  className,
  featured = false,
  children,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  className?: string;
  featured?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={`max-w-full overflow-hidden rounded-2xl border-[#dce3ef] p-5 shadow-none web:transition-[transform,box-shadow,border-color] web:duration-200 motion-reduce:web:transition-none web:hover:-translate-y-0.5 web:hover:border-primary/40 web:hover:shadow-lg md:p-7 ${
        featured ? "bg-secondary" : "bg-white"
      } ${className ?? ""}`}
    >
      <VStack space="md">
        <Box
          className={`h-11 w-11 items-center justify-center rounded-xl ${
            featured ? "bg-white/10" : "bg-primary/10"
          }`}
        >
          <Icon
            size={20}
            color={featured ? landingColors.paleBlue : landingColors.cornflower}
          />
        </Box>
        <Heading size="lg" className={featured ? "text-white" : "text-secondary"}>
          {title}
        </Heading>
        <Text
          size="sm"
          className={`font-light leading-6 ${featured ? "text-[#c8d2e6]" : "text-muted-foreground"}`}
        >
          {description}
        </Text>
      </VStack>
      {children}
    </Card>
  );
}

export function WorkflowSection({
  isDesktop,
  onLayout,
}: {
  isDesktop: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();
  const steps = [
    [BookOpen, "landing.workflow.step1.title", "landing.workflow.step1.description"],
    [FileOutput, "landing.workflow.step2.title", "landing.workflow.step2.description"],
    [Send, "landing.workflow.step3.title", "landing.workflow.step3.description"],
  ] as const;

  return (
    <Box
      onLayout={(event) => onLayout("workflow", event)}
      testID="landing-section-workflow"
      className="bg-background px-4 py-16 md:px-8 md:py-28"
    >
      <Box className="mx-auto w-full max-w-[1120px]">
        <Box className={`gap-10 ${isDesktop ? "flex-row" : ""}`}>
          <VStack className={isDesktop ? "w-[34%]" : ""} space="md">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-primary">
              {t("landing.workflow.eyebrow")}
            </Text>
            <Heading className="text-3xl leading-tight tracking-tight text-secondary md:text-4xl">
              {t("landing.workflow.title")}
            </Heading>
            <Text className="font-light leading-7 text-muted-foreground">
              {t("landing.workflow.subtitle")}
            </Text>
          </VStack>
          <VStack className={isDesktop ? "flex-1" : ""}>
            {steps.map(([Icon, titleKey, descriptionKey], index) => (
              <HStack key={titleKey} className="relative gap-4 pb-8 last:pb-0 md:gap-6">
                <VStack className="items-center">
                  <Box className="h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                    <Icon size={20} color={landingColors.paleBlue} />
                  </Box>
                  {index < steps.length - 1 ? (
                    <Box className="mt-2 min-h-10 w-px flex-1 bg-primary/35" />
                  ) : null}
                </VStack>
                <VStack className="flex-1 pt-1" space="xs">
                  <Text className="text-xs font-semibold tracking-widest text-primary">
                    0{index + 1}
                  </Text>
                  <Heading size="lg" className="text-secondary">
                    {t(titleKey)}
                  </Heading>
                  <Text size="sm" className="max-w-[620px] font-light leading-6 text-muted-foreground">
                    {t(descriptionKey)}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}

export function RoadmapSection({
  isDesktop,
  onLayout,
}: {
  isDesktop: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();
  const roadmap = [
    [Landmark, "landing.roadmap.bank.title", "landing.roadmap.bank.description"],
    [Sparkles, "landing.roadmap.tax.title", "landing.roadmap.tax.description"],
    [Package, "landing.roadmap.m2m.title", "landing.roadmap.m2m.description"],
  ] as const;

  return (
    <Box
      onLayout={(event) => onLayout("roadmap", event)}
      testID="landing-section-roadmap"
      className="bg-[#1f305e] px-4 py-16 md:px-8 md:py-24"
    >
      <Box className={`mx-auto w-full max-w-[1120px] gap-10 ${isDesktop ? "flex-row" : ""}`}>
        <VStack className={isDesktop ? "w-[38%]" : ""} space="md">
          <Box className="self-start rounded-lg border border-primary/40 px-2.5 py-1">
            <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-[#d9e7ff]">
              {t("landing.roadmap.label")}
            </Text>
          </Box>
          <Heading className="text-3xl leading-tight tracking-tight text-white md:text-4xl">
            {t("landing.roadmap.title")}
          </Heading>
          <Text className="font-light leading-7 text-[#c8d2e6]">
            {t("landing.roadmap.description")}
          </Text>
        </VStack>
        <VStack className={isDesktop ? "flex-1" : ""} space="sm">
          {roadmap.map(([Icon, titleKey, descriptionKey]) => (
            <HStack
              key={titleKey}
              className="gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5"
            >
              <Box className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Icon size={18} color={landingColors.paleBlue} />
              </Box>
              <VStack className="flex-1" space="xs">
                <HStack className="items-center justify-between gap-3">
                  <Text className="font-semibold text-white">{t(titleKey)}</Text>
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-[#aebee0]">
                    {t("landing.roadmap.future")}
                  </Text>
                </HStack>
                <Text size="sm" className="font-light leading-6 text-[#b9c6df]">
                  {t(descriptionKey)}
                </Text>
              </VStack>
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}

export function BlogInsightsSection({
  isDesktop,
  onLayout,
  onOpenBlog,
  onOpenPost,
}: {
  isDesktop: boolean;
  onLayout: SectionLayoutHandler;
  onOpenBlog: () => void;
  onOpenPost: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const posts = listBlogPosts().slice(0, 3);

  return (
    <Box
      onLayout={(event) => onLayout("insights", event)}
      testID="landing-section-insights"
      className="bg-[#edf2fa] px-4 py-16 md:px-8 md:py-24"
    >
      <Box className="mx-auto w-full max-w-[1120px]">
        <Box className={`mb-10 gap-6 ${isDesktop ? "flex-row items-end justify-between" : ""}`}>
          <VStack className="max-w-[640px]" space="md">
            <Text className={`${landingDisplayType.kicker} text-primary`}>
              {t("landing.insights.eyebrow")}
            </Text>
            <Heading className={`${landingDisplayType.section} font-heading leading-tight tracking-tight text-secondary`}>
              {t("landing.insights.title")}
            </Heading>
            <Text className="font-light leading-7 text-muted-foreground">
              {t("landing.insights.subtitle")}
            </Text>
          </VStack>
          <Button
            variant="outline"
            className="self-start border-secondary/20"
            onPress={onOpenBlog}
            testID="landing-insights-all"
          >
            <ButtonText className="text-secondary">{t("landing.insights.viewAll")}</ButtonText>
            <ArrowRight size={16} color={landingColors.navy} />
          </Button>
        </Box>

        <Box className={`gap-4 ${isDesktop ? "flex-row" : ""}`}>
          {posts.map((post) => (
            <Pressable
              key={post.slug}
              accessibilityRole="link"
              onPress={() => onOpenPost(post.slug)}
              className="min-w-0 flex-1 rounded-marketing border border-[#dce3ef] bg-white p-5 web:transition-[transform,box-shadow] web:duration-200 web:hover:-translate-y-0.5 web:hover:shadow-lg md:p-6"
              testID={`landing-insight-${post.slug}`}
            >
              <VStack space="sm">
                <Text size="xs" className="font-semibold uppercase tracking-wider text-primary">
                  {post.tags[0]}
                </Text>
                <Heading size="md" className="text-secondary">
                  {post.title}
                </Heading>
                <Text size="sm" className="font-light leading-6 text-muted-foreground">
                  {post.description}
                </Text>
              </VStack>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export function FinalCta({
  isSignedIn,
  onPrimaryAction,
}: {
  isSignedIn: boolean;
  onPrimaryAction: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box className="bg-background px-4 py-16 md:px-8 md:py-24">
      <Box className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[24px] bg-secondary p-6 md:p-12">
        <Box className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-primary/25 blur-2xl" />
        <Box className="relative gap-8 md:flex-row md:items-end md:justify-between">
          <VStack className="max-w-[680px]" space="md">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-primary">
              {t("landing.finalCta.eyebrow")}
            </Text>
            <Heading className="text-3xl leading-tight tracking-tight text-white md:text-4xl">
              {t("landing.finalCta.title")}
            </Heading>
            <Text className="font-light leading-7 text-[#c8d2e6]">
              {t("landing.finalCta.description")}
            </Text>
          </VStack>
          <Button
            size="lg"
            className="w-full web:transition-transform web:duration-200 web:hover:scale-[1.02] md:w-auto"
            onPress={onPrimaryAction}
            testID="landing-final-cta"
          >
            <ButtonText>
              {isSignedIn ? t("landing.goToDashboard") : t("landing.getStartedFree")}
            </ButtonText>
            <ArrowRight size={18} color={landingColors.white} />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export function LandingFooter({
  onNavigateRoute,
  onLogin,
  onOpenBlog,
  onOpenCookiePreferences,
}: {
  onNavigateRoute: (
    route: (typeof routes)[keyof Pick<
      typeof routes,
      "terms" | "privacy" | "cookies" | "imprint" | "blog"
    >],
  ) => void;
  onLogin: () => void;
  onOpenBlog: () => void;
  onOpenCookiePreferences: () => void;
}) {
  const { t } = useTranslation();
  const legalLinks = [
    [routes.terms, "landing.footer.terms"],
    [routes.privacy, "landing.footer.privacy"],
    [routes.cookies, "landing.footer.cookies"],
    [routes.imprint, "landing.footer.imprint"],
  ] as const;

  return (
    <Box
      className="border-t border-white/10 bg-secondary px-4 py-12 md:px-8"
      testID="landing-footer"
    >
      <Box className="mx-auto w-full max-w-[1120px]">
        <Box className="gap-8 md:flex-row md:justify-between">
          <VStack className="max-w-[330px]" space="md">
            <BrandLogo tone="onDark" height={36} testID="landing-footer-logo" />
            <Text size="sm" className="font-light leading-6 text-[#aebbd3]">
              {t("landing.footer.description")}
            </Text>
          </VStack>
          <Box className="gap-8 sm:flex-row">
            <VStack space="sm">
              <Text size="xs" className="font-semibold uppercase tracking-wider text-[#8899ba]">
                {t("landing.footer.product")}
              </Text>
              <FooterLink label={t("landing.footer.login")} onPress={onLogin} />
              <FooterLink
                label={t("landing.footer.cookiePreferences")}
                onPress={onOpenCookiePreferences}
                testID="footer-cookie-preferences"
              />
            </VStack>
            <VStack space="sm">
              <Text size="xs" className="font-semibold uppercase tracking-wider text-[#8899ba]">
                {t("landing.footer.resources")}
              </Text>
              <FooterLink
                label={t("landing.footer.blog")}
                onPress={onOpenBlog}
                testID="landing-footer-blog"
              />
            </VStack>
            <VStack space="sm">
              <Text size="xs" className="font-semibold uppercase tracking-wider text-[#8899ba]">
                {t("landing.footer.legal")}
              </Text>
              {legalLinks.map(([route, labelKey]) => (
                <FooterLink
                  key={String(route)}
                  label={t(labelKey)}
                  onPress={() => onNavigateRoute(route)}
                />
              ))}
            </VStack>
          </Box>
        </Box>
        <Box className="my-8 h-px bg-white/10" />
        <Text size="xs" className="text-[#8899ba]">
          {t("landing.footer.copyright", { year: new Date().getFullYear() })}
        </Text>
      </Box>
    </Box>
  );
}

function FooterLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      testID={testID}
      className="min-h-8 justify-center rounded-md web:transition-opacity web:hover:opacity-75 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
    >
      <Text size="sm" className="text-[#dce4f2]">
        {label}
      </Text>
    </Pressable>
  );
}
