// components/navigation/AppShell.tsx
// The signed-in app's chrome: a persistent desktop sidebar + top strip
// (≥1024px), or a mobile header + bottom tab bar + "Továbbiak" sheet
// (<1024px). Fixes N1 ("the menu isn't clear") — every primary section is
// now one click away on both breakpoints (spec §1).
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import type { BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppTopStrip } from "@/components/navigation/AppTopStrip";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { MoreSheet } from "@/components/navigation/MoreSheet";
import { useSidebarCollapsed } from "@/components/navigation/useSidebarCollapsed";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { signOut, useSession } from "@/lib/auth-client";
import { getPageTitleLabelKey, getSettingsBreadcrumbLabelKey } from "@/lib/app-navigation";
import { routes, type AppRoute } from "@/lib/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { useCompany } from "@/hooks/useCompany";

// Shell breakpoint — moved from 768 to 1024 (spec §1.2): 768-1023px (tablet)
// now gets the thumb-friendly mobile bars instead of a half-collapsed
// desktop sidebar that doesn't fit.
const DESKTOP_BREAKPOINT = 1024;

export type AppShellProps = {
  /** Test-only override for the measured window width, so the desktop/
   * mobile breakpoint is testable without mocking react-native's Dimensions
   * module (matches the pattern used by AppSidebar). */
  viewportWidthForTest?: number;
};

export function AppShell({ viewportWidthForTest }: AppShellProps = {}) {
  const { width: measuredWidth } = useWindowDimensions();
  const width = viewportWidthForTest ?? measuredWidth;
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { company } = useCompany();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const { collapsed, toggleCollapsed } = useSidebarCollapsed(width);

  const {
    notifications,
    unreadCount,
    latestUnread,
    loading: notificationsLoading,
    markRead,
    markAllRead,
    sync,
  } = useNotifications({ syncOnMount: true });

  function navigate(href: AppRoute) {
    router.push(href);
  }

  async function handleSignOut() {
    await signOut();
    router.replace(routes.login);
  }

  const settingsLabelKey = getSettingsBreadcrumbLabelKey(pathname);
  const breadcrumb: BreadcrumbItem[] | undefined = settingsLabelKey
    ? [{ label: t("nav.settings"), href: routes.settings }, { label: t(settingsLabelKey) }]
    : undefined;
  const pageTitleLabelKey = getPageTitleLabelKey(pathname);

  const notificationPanel = (
    <NotificationPanel
      open={panelOpen}
      onClose={() => setPanelOpen(false)}
      notifications={notifications}
      unreadCount={unreadCount}
      loading={notificationsLoading}
      onMarkRead={(id) => void markRead(id)}
      onMarkAllRead={() => void markAllRead()}
      onSync={() => void sync()}
    />
  );

  if (isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <HStack className="flex-1">
          <AppSidebar
            activePathname={pathname}
            role={userRole}
            companyName={company?.name}
            companyTaxId={company?.taxNumber ?? undefined}
            collapsed={collapsed}
            onNavigate={navigate}
            onNewInvoice={() => router.push(routes.newInvoice)}
            onOpenCompanySettings={() => router.push(routes.settingsCompany)}
            onSignOut={() => void handleSignOut()}
          />
          <VStack className="flex-1">
            <AppTopStrip
              breadcrumb={breadcrumb}
              pageTitleLabelKey={pageTitleLabelKey}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              unreadCount={unreadCount}
              onOpenNotifications={() => setPanelOpen(true)}
              userName={session?.user?.name}
              companyName={company?.name}
              onOpenAccount={() => router.push(routes.settings)}
              onOpenCompany={() => router.push(routes.settingsCompany)}
              onSignOut={() => void handleSignOut()}
            />
            {latestUnread ? (
              <NotificationBanner
                notification={latestUnread}
                unreadCount={unreadCount}
                onPress={() => setPanelOpen(true)}
              />
            ) : null}
            <Box className="flex-1">
              <Slot />
            </Box>
          </VStack>
        </HStack>
        {notificationPanel}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <MobileAppHeader
        userName={session?.user?.name}
        userRole={userRole}
        companyName={company?.name}
        unreadCount={unreadCount}
        onOpenNotifications={() => setPanelOpen(true)}
      />
      {latestUnread ? (
        <NotificationBanner
          notification={latestUnread}
          unreadCount={unreadCount}
          onPress={() => setPanelOpen(true)}
        />
      ) : null}
      <Box className="flex-1">
        <Slot />
      </Box>
      <MobileTabBar pathname={pathname} onNavigate={navigate} onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={userRole}
        onNavigate={navigate}
        onSignOut={() => void handleSignOut()}
      />
      {notificationPanel}
    </SafeAreaView>
  );
}
