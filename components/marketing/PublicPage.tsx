// components/marketing/PublicPage.tsx
// Chrome of the public pages that are not the landing (legal pages, blog,
// public receipt check, 404): the landing header (solid, in flow), the page
// body, the landing footer and the cookie consent, so the footer's cookie
// preferences link works everywhere.
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CookieConsent } from "@/components/marketing/CookieConsent";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { LandingFooter } from "@/components/marketing/LandingSections";
import { LANDING_DESKTOP_MIN } from "@/components/marketing/landing-theme";
import { Box } from "@/components/ui/box";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";
import { useHydrated } from "@/lib/useHydrated";

/**
 * Header props for pages that have no landing sections to scroll to: a header
 * link then takes the reader to the landing, which has them.
 */
export function usePublicHeaderProps() {
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session);

  return {
    isDesktop: hydrated && width >= LANDING_DESKTOP_MIN,
    isSignedIn,
    forceSolid: true,
    onNavigate: () => router.push(routes.home),
    onLogin: () => router.push(routes.login),
    onPrimaryAction: () => router.push(isSignedIn ? routes.dashboard : routes.login),
    onOpenBlog: () => router.push(routes.blog),
  };
}

type PublicPageProps = {
  children: React.ReactNode;
  testID?: string;
};

export function PublicPage({ children, testID }: PublicPageProps) {
  const headerProps = usePublicHeaderProps();
  const [cookieRequest, setCookieRequest] = React.useState(0);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <LandingHeader {...headerProps} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        testID={testID}
      >
        <Box className="min-w-0 flex-1">{children}</Box>
        <LandingFooter
          onNavigateRoute={(route) => router.push(route)}
          onLogin={() => router.push(routes.login)}
          onOpenBlog={() => router.push(routes.blog)}
          onOpenCookiePreferences={() => setCookieRequest((n) => n + 1)}
        />
      </ScrollView>
      <CookieConsent
        reopenRequest={cookieRequest}
        onOpenPolicy={() => router.push(routes.cookies)}
      />
    </SafeAreaView>
  );
}

/** Prose column of the legal pages and blog articles: 680px max (SPEC §10.6). */
export const proseStyles = {
  column: "mx-auto w-full max-w-[680px] px-4 py-10 tab:px-6 tab:py-14",
  h1: "font-heading text-[32px] phone:text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-ink",
  h2: "font-heading text-xl font-bold leading-[1.25] text-ink",
  body: "text-base leading-[1.6] text-ink",
  meta: "text-sm text-muted-ink",
} as const;
