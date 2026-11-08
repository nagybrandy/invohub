// components/marketing/LandingSections.tsx
// The landing page sections (SPEC §10.4), top to bottom: hero (full-bleed
// navy), transition, capabilities, workflow, insights, final call-to-action
// (navy card), footer. Colours come from the theme tokens; the copy is the
// existing landing.* keys, nothing new is claimed.
import * as React from "react";
import { Platform, useWindowDimensions } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { BellRing, Check, FileText, Mail, ReceiptText, Users } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { BrandTexture } from "@/components/marketing/BrandTexture";
import { formatBlogDate } from "@/components/marketing/blog-format";
import { type LandingSectionId } from "@/components/marketing/LandingHeader";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { ShowcasePill } from "@/components/marketing/ShowcasePill";
import { SAMPLE_INVOICES } from "@/components/marketing/sample-data";
import {
  landingColumns,
  landingLayout,
  landingType,
  type LandingColumns,
} from "@/components/marketing/landing-theme";
import { listBlogPosts } from "@/lib/blog";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { LAYOUT } from "@/lib/theme/layout";
import { type } from "@/lib/ui/type";

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

const isWeb = Platform.OS === "web";

function SectionHeader({
  eyebrow,
  title,
  lead,
  onNavy = false,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  onNavy?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <VStack className="min-w-0 max-w-[680px] gap-3">
      <Text className={onNavy ? landingType.eyebrowOnNavy : landingType.eyebrow}>{eyebrow}</Text>
      <Heading size="3xl" className={onNavy ? landingType.h2OnNavy : landingType.h2}>
        {title}
      </Heading>
      {lead ? <Text className={`${landingType.lead} max-w-[62ch]`}>{lead}</Text> : null}
      {children}
    </VStack>
  );
}

export function LandingHero({
  isDesktop,
  isSignedIn,
  onPrimaryAction,
  onProductTour,
  onOpenBlog,
}: LandingHeroProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { width } = useWindowDimensions();
  const compactShowcase = width <= LAYOUT.phoneMax;
  const ctaLabel = isSignedIn ? t("landing.goToDashboard") : t("landing.getStartedFree");
  // On web the header is a fixed overlay on top of the band, so the band
  // clears its 64px; on native the header sits above it in the flow.
  const topPadding = isDesktop
    ? isWeb
      ? "pt-[136px]"
      : "pt-14"
    : isWeb
      ? "pt-[96px]"
      : "pt-10";

  return (
    <Box
      testID="landing-hero"
      className={`on-navy relative overflow-hidden bg-navy ${topPadding} pb-12 tab:pb-[88px]`}
    >
      {isDesktop ? (
        <BrandTexture
          variant="mark"
          tone="onDark"
          size={460}
          rotate={12}
          opacity={0.06}
          className="-right-24 -top-16"
          testID="landing-hero-texture"
        />
      ) : null}
      <Box
        className={`${landingLayout.container} relative z-[1] gap-10 ${
          isDesktop ? "flex-row items-center gap-14" : ""
        }`}
      >
        <VStack className={`min-w-0 gap-6 ${isDesktop ? "flex-1 basis-0" : ""}`}>
          <Box
            testID="landing-hero-brand"
            className="self-start rounded-full bg-white/10 px-3.5 py-1.5"
          >
            <Text className="text-[13px] font-semibold text-white">{t("landing.hero.eyebrow")}</Text>
          </Box>
          <Heading size="4xl" className={`${landingType.heroTitle} max-w-[560px]`}>
            {t("landing.hero.title")}
          </Heading>
          <Text className="max-w-[52ch] text-base leading-7 text-navy-ink tab:text-lg">
            {t("landing.hero.subtitle")}
          </Text>
          <Box className="gap-3 tab:flex-row tab:flex-wrap tab:items-center">
            <Button
              size="lg"
              className="w-full tab:w-auto"
              accessibilityLabel={ctaLabel}
              testID="landing-hero-cta"
              onPress={onPrimaryAction}
            >
              <ButtonText>{ctaLabel}</ButtonText>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full border-white/[0.28] bg-transparent data-[hover=true]:bg-white/10 data-[active=true]:bg-white/10 tab:w-auto"
              onPress={onProductTour}
              testID="landing-product-tour"
            >
              <ButtonText className="text-white">{t("landing.hero.productTour")}</ButtonText>
            </Button>
            <Button
              size="lg"
              variant="tertiary"
              className="w-full data-[hover=true]:bg-white/10 data-[active=true]:bg-white/10 tab:w-auto"
              onPress={onOpenBlog}
              testID="landing-hero-blog"
            >
              <ButtonText className="text-white">{t("landing.hero.readBlog")}</ButtonText>
            </Button>
          </Box>
          <HStack className="items-start gap-2">
            <Box className="pt-0.5">
              <Check size={16} color={icons.onNavy} />
            </Box>
            <Text className="min-w-0 max-w-[52ch] flex-1 text-sm leading-5 text-navy-ink">
              {t("landing.hero.reassurance")}
            </Text>
          </HStack>
        </VStack>
        <Box className={`min-w-0 ${isDesktop ? "flex-1 basis-0" : "w-full"}`}>
          <ProductShowcase compact={compactShowcase} />
        </Box>
      </Box>
    </Box>
  );
}

export function ProductTransition({
  onLayout,
}: {
  isDesktop?: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();

  return (
    <Box
      onLayout={(event) => onLayout("product", event)}
      testID="landing-section-product"
      className={`${landingLayout.anchor} bg-canvas pb-10 pt-14 tab:pb-14 tab:pt-[88px]`}
    >
      <VStack className={`${landingLayout.container} gap-6`}>
        <SectionHeader
          eyebrow={t("landing.transition.eyebrow")}
          title={t("landing.transition.title")}
          lead={t("landing.transition.description")}
        />
        <Box className="max-w-[760px] rounded-card border-l-[3px] border-primary bg-surface p-5 shadow-card tab:p-6">
          <Text className="text-[17px] font-medium leading-7 text-ink tab:text-lg">
            {t("landing.transition.statement")}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

type CapabilityKey = "invoice" | "delivery" | "records" | "reminder" | "receipt";

const CAPABILITY_ORDER: readonly CapabilityKey[] = [
  "invoice",
  "delivery",
  "records",
  "reminder",
  "receipt",
];

/**
 * Rows of the capability grid. Three columns: the invoice card spans two, so
 * the first row is [invoice (2), delivery (1)] and the rest sit three to a
 * row; two columns: the invoice card takes a full row; one column: stacked.
 */
export function capabilityRows(
  columns: LandingColumns,
): Array<Array<{ key: CapabilityKey; span: number }>> {
  const [invoice, ...rest] = CAPABILITY_ORDER;
  if (columns === 3) {
    return [
      [
        { key: invoice, span: 2 },
        { key: rest[0], span: 1 },
      ],
      rest.slice(1).map((key) => ({ key, span: 1 })),
    ];
  }
  if (columns === 2) {
    return [
      [{ key: invoice, span: 2 }],
      rest.slice(0, 2).map((key) => ({ key, span: 1 })),
      rest.slice(2).map((key) => ({ key, span: 1 })),
    ];
  }
  return CAPABILITY_ORDER.map((key) => [{ key, span: 1 }]);
}

const capabilityIcons = {
  invoice: FileText,
  delivery: Mail,
  records: Users,
  reminder: BellRing,
  receipt: ReceiptText,
} as const;

export function CapabilityBento({
  onLayout,
}: {
  isDesktop?: boolean;
  onLayout: SectionLayoutHandler;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const rows = capabilityRows(landingColumns(width));

  return (
    <Box
      onLayout={(event) => onLayout("capabilities", event)}
      testID="landing-section-capabilities"
      className={`${landingLayout.anchor} overflow-x-hidden bg-canvas py-10 tab:py-14`}
    >
      <VStack className={`${landingLayout.container} gap-8 tab:gap-10`}>
        <SectionHeader
          eyebrow={t("landing.capabilities.eyebrow")}
          title={t("landing.capabilities.title")}
          lead={t("landing.capabilities.subtitle")}
        />
        <VStack className="min-w-0 gap-4" testID="landing-capability-grid">
          {rows.map((row) => (
            <Box key={row.map((cell) => cell.key).join("-")} className="min-w-0 gap-4 tab:flex-row">
              {row.map(({ key, span }) => (
                <CapabilityCard
                  key={key}
                  capability={key}
                  title={t(`landing.capabilities.${key}.title`)}
                  description={t(`landing.capabilities.${key}.description`)}
                  span={span}
                >
                  {key === "invoice" ? <InvoiceIllustration /> : null}
                </CapabilityCard>
              ))}
            </Box>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
}

/** Static invoice card of the first capability, with the sample-data label. */
function InvoiceIllustration() {
  const { t } = useTranslation();
  const sample = SAMPLE_INVOICES[0];

  return (
    <Box
      testID="landing-invoice-illustration"
      accessibilityRole="image"
      accessibilityLabel={`${t("landing.capabilities.invoice.preview")} · ${t("landing.product.sampleData")}`}
      className="mt-5 overflow-hidden rounded-control border border-line bg-wash2"
    >
      <Box
        aria-hidden={true}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <HStack className="items-center justify-between gap-3 px-4 py-3">
          <Text className="min-w-0 flex-shrink text-[13px] font-semibold text-ink" numberOfLines={1}>
            {t("landing.capabilities.invoice.preview")}
          </Text>
          <Text className={`text-[13px] font-bold text-ink ${type.money}`}>{sample.amount}</Text>
        </HStack>
        <HStack className="items-center justify-between gap-3 border-t border-line px-4 py-3">
          <Text className="min-w-0 flex-shrink text-[13px] text-muted-ink" numberOfLines={1}>
            {sample.client}
          </Text>
          <ShowcasePill status={sample.status} />
        </HStack>
        <Box className="border-t border-line px-4 py-2">
          <Text className="text-[11px] text-muted-ink">{t("landing.product.sampleData")}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function CapabilityCard({
  capability,
  title,
  description,
  span,
  children,
}: {
  capability: CapabilityKey;
  title: string;
  description: string;
  span: number;
  children?: React.ReactNode;
}) {
  const icons = useIconColors();
  const Icon = capabilityIcons[capability];

  return (
    <Box
      testID={`landing-capability-${capability}`}
      className={`min-w-0 rounded-card bg-surface p-[22px] shadow-card ${
        span === 2 ? "tab:flex-[2] tab:basis-0" : "tab:flex-1 tab:basis-0"
      }`}
    >
      <VStack className="gap-3">
        <Box className="h-9 w-9 items-center justify-center rounded-[9px] bg-primary-wash">
          <Icon size={18} color={icons.primary} />
        </Box>
        <Heading size="md" className={landingType.cardTitle}>
          {title}
        </Heading>
        <Text className={landingType.cardBody}>{description}</Text>
      </VStack>
      {children}
    </Box>
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
    ["landing.workflow.step1.title", "landing.workflow.step1.description"],
    ["landing.workflow.step2.title", "landing.workflow.step2.description"],
    ["landing.workflow.step3.title", "landing.workflow.step3.description"],
  ] as const;

  return (
    <Box
      onLayout={(event) => onLayout("workflow", event)}
      testID="landing-section-workflow"
      className={`${landingLayout.anchor} bg-canvas py-10 tab:py-14`}
    >
      <VStack className={`${landingLayout.container} gap-8 tab:gap-10`}>
        <SectionHeader
          eyebrow={t("landing.workflow.eyebrow")}
          title={t("landing.workflow.title")}
          lead={t("landing.workflow.subtitle")}
        />
        <Box className={`min-w-0 gap-4 ${isDesktop ? "flex-row" : ""}`}>
          {steps.map(([titleKey, descriptionKey], index) => (
            <Box
              key={titleKey}
              testID={`landing-workflow-step-${index + 1}`}
              className={`min-w-0 rounded-card bg-surface p-[22px] shadow-card ${
                isDesktop ? "flex-1 basis-0" : ""
              }`}
            >
              <HStack className="mb-4 items-center gap-3">
                <Box className="h-[30px] w-[30px] items-center justify-center rounded-full bg-neutral-wash">
                  <Text className="text-sm font-bold text-muted-ink">{index + 1}</Text>
                </Box>
                {isDesktop && index < steps.length - 1 ? (
                  <Box className="h-px flex-1 bg-line-strong" />
                ) : null}
              </HStack>
              <Text className="text-[15px] font-semibold leading-[1.3] text-ink">{t(titleKey)}</Text>
              <Text className={`${landingType.cardBody} mt-1.5`}>{t(descriptionKey)}</Text>
            </Box>
          ))}
        </Box>
      </VStack>
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
  const { t, i18n } = useTranslation();
  const posts = listBlogPosts().slice(0, 3);

  return (
    <Box
      onLayout={(event) => onLayout("insights", event)}
      testID="landing-section-insights"
      className={`${landingLayout.anchor} bg-canvas py-10 tab:py-14`}
    >
      <VStack className={`${landingLayout.container} gap-8 tab:gap-10`}>
        <Box className={`gap-4 ${isDesktop ? "flex-row items-end justify-between" : ""}`}>
          <SectionHeader
            eyebrow={t("landing.insights.eyebrow")}
            title={t("landing.insights.title")}
            lead={t("landing.insights.subtitle")}
          />
          <Button
            variant="tertiary"
            className="self-start"
            onPress={onOpenBlog}
            testID="landing-insights-all"
          >
            <ButtonText className="text-primary">{t("landing.insights.viewAll")}</ButtonText>
          </Button>
        </Box>

        <Box className={`min-w-0 gap-4 ${isDesktop ? "flex-row" : ""}`}>
          {posts.map((post) => (
            <Pressable
              key={post.slug}
              accessibilityRole="link"
              onPress={() => onOpenPost(post.slug)}
              className={`min-w-0 rounded-card bg-surface p-5 shadow-card web:transition-shadow web:duration-150 web:hover:shadow-menu web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary ${
                isDesktop ? "flex-1 basis-0" : ""
              }`}
              testID={`landing-insight-${post.slug}`}
            >
              <VStack className="gap-2">
                <Heading size="md" className={landingType.cardTitle}>
                  {post.title}
                </Heading>
                <Text className={landingType.cardBody}>{post.description}</Text>
                <Text className="pt-1 text-xs text-muted-ink">
                  {formatBlogDate(post.publishedAt, i18n.language)}
                </Text>
              </VStack>
            </Pressable>
          ))}
        </Box>
      </VStack>
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
    <Box className="bg-canvas pb-10 pt-4 tab:pb-14">
      <Box className={landingLayout.container}>
        <Box
          testID="landing-final-cta-card"
          className="on-navy relative overflow-hidden rounded-dialog bg-navy p-7 tab:p-12"
        >
          <BrandTexture
            variant="mark"
            tone="onDark"
            size={320}
            rotate={-16}
            opacity={0.06}
            className="-bottom-28 -right-20"
            testID="landing-final-cta-texture"
          />
          <Box className="relative gap-7 tab:flex-row tab:items-end tab:justify-between">
            <VStack className="min-w-0 max-w-[640px] gap-3">
              <Text className={landingType.eyebrowOnNavy}>{t("landing.finalCta.eyebrow")}</Text>
              <Heading size="3xl" className={landingType.h2OnNavy}>
                {t("landing.finalCta.title")}
              </Heading>
              <Text className="text-base leading-6 text-navy-ink">
                {t("landing.finalCta.description")}
              </Text>
            </VStack>
            <Button
              size="lg"
              className="w-full tab:w-auto"
              onPress={onPrimaryAction}
              testID="landing-final-cta"
            >
              <ButtonText>
                {isSignedIn ? t("landing.goToDashboard") : t("landing.getStartedFree")}
              </ButtonText>
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export type FooterRoute = (typeof routes)[keyof Pick<
  typeof routes,
  "terms" | "privacy" | "cookies" | "imprint" | "blog" | "developers"
>];

export function LandingFooter({
  onNavigateRoute,
  onLogin,
  onOpenBlog,
  onOpenCookiePreferences,
}: {
  onNavigateRoute: (route: FooterRoute) => void;
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
    <Box className="border-t border-line bg-surface pb-8 pt-12" testID="landing-footer">
      <Box className={landingLayout.container}>
        <Box className="gap-8 tab:flex-row tab:gap-10">
          <VStack className="min-w-0 gap-3 tab:max-w-[300px] tab:flex-[1.4] tab:basis-0">
            <BrandLogo tone="onLight" height={36} testID="landing-footer-logo" />
            <Text className="text-sm leading-[22px] text-muted-ink">
              {t("landing.footer.description")}
            </Text>
          </VStack>
          <FooterColumn title={t("landing.footer.product")}>
            <FooterLink
              label={t("landing.footer.login")}
              onPress={onLogin}
              testID="landing-footer-login"
            />
          </FooterColumn>
          <FooterColumn title={t("landing.footer.resources")}>
            <FooterLink
              label={t("landing.footer.blog")}
              onPress={onOpenBlog}
              testID="landing-footer-blog"
            />
            <FooterLink
              label={t("landing.footer.developers")}
              onPress={() => onNavigateRoute(routes.developers)}
              testID="landing-footer-developers"
            />
          </FooterColumn>
          <FooterColumn title={t("landing.footer.legal")}>
            {legalLinks.map(([route, labelKey]) => (
              <FooterLink
                key={String(route)}
                label={t(labelKey)}
                onPress={() => onNavigateRoute(route)}
              />
            ))}
            <FooterLink
              label={t("landing.footer.cookiePreferences")}
              onPress={onOpenCookiePreferences}
              testID="footer-cookie-preferences"
            />
          </FooterColumn>
        </Box>
        <Box className="mt-8 border-t border-line pt-6">
          <Text className="text-[13px] text-muted-ink">
            {t("landing.footer.copyright", { year: new Date().getFullYear() })}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack className="min-w-0 gap-1 tab:flex-1 tab:basis-0">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-ink">
        {title}
      </Text>
      {children}
    </VStack>
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
      className="min-h-10 justify-center self-start rounded-control web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary"
    >
      <Text className="text-sm text-ink web:hover:text-primary">{label}</Text>
    </Pressable>
  );
}
