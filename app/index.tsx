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
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";

const LANDING_HEADER_OFFSET = 76;

export default function Landing() {
  const { width } = useWindowDimensions();
  const { data: session } = useSession();
  const scrollRef = React.useRef<ScrollView>(null);
  const sectionOffsets = React.useRef<Partial<Record<LandingSectionId, number>>>({});
  const [cookiePreferenceRequest, setCookiePreferenceRequest] = React.useState(0);
  const isDesktop = width >= 768;
  const isSignedIn = Boolean(session);

  React.useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const elements = [document.documentElement, document.body, document.getElementById("root")]
      .filter((element): element is HTMLElement => Boolean(element));
    const previousStyles = elements.map((element) => ({
      element,
      overflowX: element.style.overflowX,
      overflowY: element.style.overflowY,
    }));

    elements.forEach((element) => {
      element.style.overflowX = "hidden";
      element.style.overflowY = "auto";
    });

    return () => {
      previousStyles.forEach(({ element, overflowX, overflowY }) => {
        element.style.overflowX = overflowX;
        element.style.overflowY = overflowY;
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

  const sections = (
    <>
      <LandingHeader
        isDesktop={isDesktop}
        isSignedIn={isSignedIn}
        onNavigate={navigateToSection}
        onLogin={() => router.push(routes.login)}
        onPrimaryAction={primaryAction}
      />
      <LandingHero
        isDesktop={isDesktop}
        isSignedIn={isSignedIn}
        onPrimaryAction={primaryAction}
        onProductTour={() => navigateToSection("product")}
      />
      <ProductTransition isDesktop={isDesktop} onLayout={onSectionLayout} />
      <CapabilityBento isDesktop={isDesktop} onLayout={onSectionLayout} />
      <WorkflowSection isDesktop={isDesktop} onLayout={onSectionLayout} />
      <RoadmapSection isDesktop={isDesktop} onLayout={onSectionLayout} />
      <FinalCta isSignedIn={isSignedIn} onPrimaryAction={primaryAction} />
      <LandingFooter
        onNavigateRoute={(route) => router.push(route)}
        onLogin={() => router.push(routes.login)}
        onOpenCookiePreferences={() =>
          setCookiePreferenceRequest((request) => request + 1)
        }
      />
    </>
  );

  if (Platform.OS === "web") {
    return (
      <Box className="min-h-screen bg-background" testID="landing-page">
        {sections}
        <CookieConsent
          reopenRequest={cookiePreferenceRequest}
          onOpenPolicy={() => router.push(routes.cookies)}
        />
      </Box>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
