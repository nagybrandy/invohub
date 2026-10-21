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
import { AccountSwitcher } from "@/components/navigation/AccountSwitcher";
import { AppTopStrip } from "@/components/navigation/AppTopStrip";
import { ForeignAccountBanner } from "@/components/navigation/ForeignAccountBanner";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { MoreSheet } from "@/components/navigation/MoreSheet";
import { useSidebarCollapsed } from "@/components/navigation/useSidebarCollapsed";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { signOut, useSession } from "@/lib/auth-client";
import { getPageTitleLabelKey, getSettingsBreadcrumbLabelKey } from "@/lib/app-navigation";
import { routes, type AppRoute } from "@/lib/navigation";
import { takePendingInvite } from "@/lib/workspaces/pending-invite";
import { useNotifications } from "@/hooks/useNotifications";
import { useCompany } from "@/hooks/useCompany";
import { useWorkspaces } from "@/hooks/useWorkspaces";

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
  const workspaces = useWorkspaces();

  // An invitation link was opened while signed out: finish it now that we are in.
  React.useEffect(() => {
    if (!session) return;
    const pending = takePendingInvite();
    if (pending) router.replace({ pathname: "/invite", params: { token: pending } } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
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

  const foreignBanner =
    workspaces.inForeignAccount && workspaces.active ? (
      <ForeignAccountBanner
        accountName={workspaces.active.name}
        role={workspaces.role}
        onBack={() => workspaces.switchTo(null)}
      />
    ) : null;

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
            onNewReceipt={() => router.push(routes.newReceipt)}
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
              accountSwitcher={
                <AccountSwitcher workspaces={workspaces} onManage={() => router.push(routes.settingsAccess)} />
              }
            />
            {foreignBanner}
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
      {foreignBanner}
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
