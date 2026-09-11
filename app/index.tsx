// app/index.tsx
// Public landing route with landing-scoped web scrolling and native-safe composition.
import * as React from "react";
import { Platform, ScrollView, useWindowDimensions } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { CookieConsent } from "@/components/marketing/CookieConsent";
import {
  BlogInsightsSection,
  CapabilityBento,
  FinalCta,
  LandingFooter,
  LandingHero,
  ProductTransition,
  RoadmapSection,
  WorkflowSection,
} from "@/components/marketing/LandingSections";
import {
  LandingHeader,
  type LandingSectionId,
} from "@/components/marketing/LandingHeader";
import { SeoHead } from "@/components/marketing/SeoHead";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import {
  buildOrganizationJsonLd,
  buildPageSeo,
  buildSoftwareApplicationJsonLd,
} from "@/lib/seo";

const LANDING_HEADER_OFFSET = 76;
const LANDING_SCROLL_CLASS = "landing-document-scroll";

export default function Landing() {
  const { width } = useWindowDimensions();
  const { data: session } = useSession();
  const scrollRef = React.useRef<ScrollView>(null);
  const sectionOffsets = React.useRef<Partial<Record<LandingSectionId, number>>>({});
  const [cookiePreferenceRequest, setCookiePreferenceRequest] = React.useState(0);
  const isDesktop = width >= 768;
  const isSignedIn = Boolean(session);

  const seo = buildPageSeo({
    title: "InvoHub",
    description:
      "Rendezett számlázási munkatér magyar vállalkozásoknak: számlák, PDF/e-mail küldés, partnerek, termékek és fizetési emlékeztetők egy rendszerben.",
    path: "/",
  });

  React.useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const html = document.documentElement;
    html.classList.add(LANDING_SCROLL_CLASS);

    const unlockTargets: HTMLElement[] = [
      html,
      document.body,
      document.getElementById("root"),
    ].filter((element): element is HTMLElement => Boolean(element));

    let current = document.getElementById("root")?.firstElementChild as
      | HTMLElement
      | null
      | undefined;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      unlockTargets.push(current);
      current = current.firstElementChild as HTMLElement | null;
    }

    const previousStyles = unlockTargets.map((element) => ({
      element,
      cssText: element.style.cssText,
    }));

    unlockTargets.forEach((element) => {
      element.style.setProperty("display", "block", "important");
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("max-height", "none", "important");
      element.style.setProperty("min-height", "100%", "important");
      element.style.setProperty("overflow-x", "hidden", "important");
      element.style.setProperty("overflow-y", element === html || element === document.body ? "auto" : "visible", "important");
      element.style.setProperty("position", "static", "important");
      element.style.setProperty("inset", "auto", "important");
      element.style.setProperty("flex", "none", "important");
    });

    return () => {
      html.classList.remove(LANDING_SCROLL_CLASS);
      previousStyles.forEach(({ element, cssText }) => {
        element.style.cssText = cssText;
      });
    };
  }, []);

  function onSectionLayout(section: LandingSectionId, event: LayoutChangeEvent) {
    sectionOffsets.current[section] = event.nativeEvent.layout.y;
  }

  function navigateToSection(section: LandingSectionId) {
    if (Platform.OS === "web") {
      document
        .querySelector(`[data-testid="landing-section-${section}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const offset = sectionOffsets.current[section];
    if (offset !== undefined) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, offset - LANDING_HEADER_OFFSET),
        animated: true,
      });
    }
  }

  function primaryAction() {
    router.push(isSignedIn ? routes.dashboard : routes.login);
  }

  function openBlog() {
    router.push(routes.blog);
  }

  const sections = (
    <>
      <LandingHeader
        isDesktop={isDesktop}
        isSignedIn={isSignedIn}
        onNavigate={navigateToSection}
        onLogin={() => router.push(routes.login)}
        onPrimaryAction={primaryAction}
        onOpenBlog={openBlog}
      />
      <LandingHero
        isDesktop={isDesktop}
        isSignedIn={isSignedIn}
        onPrimaryAction={primaryAction}
        onProductTour={() => navigateToSection("product")}
        onOpenBlog={openBlog}
      />
      <ProductTransition isDesktop={isDesktop} onLayout={onSectionLayout} />
      <CapabilityBento isDesktop={isDesktop} onLayout={onSectionLayout} />
      <WorkflowSection isDesktop={isDesktop} onLayout={onSectionLayout} />
      <RoadmapSection isDesktop={isDesktop} onLayout={onSectionLayout} />
      <BlogInsightsSection
        isDesktop={isDesktop}
        onLayout={onSectionLayout}
        onOpenBlog={openBlog}
        onOpenPost={(slug) => router.push(routes.blogPost(slug))}
      />
      <FinalCta isSignedIn={isSignedIn} onPrimaryAction={primaryAction} />
      <LandingFooter
        onNavigateRoute={(route) => router.push(route)}
        onLogin={() => router.push(routes.login)}
        onOpenBlog={openBlog}
        onOpenCookiePreferences={() =>
          setCookiePreferenceRequest((request) => request + 1)
        }
      />
    </>
  );

  if (Platform.OS === "web") {
    return (
      <>
        <SeoHead
          seo={seo}
          jsonLd={[buildOrganizationJsonLd(), buildSoftwareApplicationJsonLd()]}
        />
        <Box className="min-h-screen w-full max-w-full overflow-x-hidden bg-background" testID="landing-page">
          {sections}
          <CookieConsent
            reopenRequest={cookiePreferenceRequest}
            onOpenPolicy={() => router.push(routes.cookies)}
          />
        </Box>
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SeoHead
        seo={seo}
        jsonLd={[buildOrganizationJsonLd(), buildSoftwareApplicationJsonLd()]}
      />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        bounces={false}
        stickyHeaderIndices={[0]}
      >
        {sections}
      </ScrollView>
      <CookieConsent
        reopenRequest={cookiePreferenceRequest}
        onOpenPolicy={() => router.push(routes.cookies)}
      />
    </SafeAreaView>
  );
}
