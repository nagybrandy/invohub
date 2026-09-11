// components/navigation/AppShell.tsx
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { DesktopTopBar } from "@/components/navigation/DesktopTopBar";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { signOut, useSession } from "@/lib/auth-client";
import { isNavActive, MOBILE_TAB_NAV, DESKTOP_TOP_NAV } from "@/lib/app-navigation";
import { routes, type AppRoute } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { useNotifications } from "@/hooks/useNotifications";
import { useCompany } from "@/hooks/useCompany";

const DESKTOP_BREAKPOINT = 768;


function MobileTabBar({
  pathname,
  onNavigate,
  t,
  iconColors,
}: {
  pathname: string;
  onNavigate: (href: AppRoute) => void;
  t: (key: string) => string;
  iconColors: ReturnType<typeof useIconColors>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Box
      className="border-t border-border bg-card"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <HStack className="items-stretch justify-around px-1 py-2">
        {MOBILE_TAB_NAV.map((item) => {
          const active = isNavActive(pathname, item.href as string);
          const Icon = item.icon;
          return (
            <Box key={item.labelKey} className="flex-1 items-center">
              <Pressable
                onPress={() => onNavigate(item.href)}
                className={`rounded-lg px-2 py-2 ${active ? "bg-primary/15" : ""}`}
              >
                <Icon size={22} color={active ? iconColors.primary : iconColors.muted} />
              </Pressable>
              <Text
                size="xs"
                className={`mt-0.5 text-center ${active ? "font-medium text-primary" : "text-muted-foreground"}`}
              >
                {t(item.labelKey)}
              </Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}

export function AppShell() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const iconColors = useIconColors();
  const { company } = useCompany();

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
        <DesktopTopBar
          companyName={company?.name}
          companyTaxId={company?.taxNumber ?? undefined}
          navItems={DESKTOP_TOP_NAV}
          activeHref={pathname}
          unreadCount={unreadCount}
          userName={session?.user?.name}
          onNavigate={navigate}
          onNewInvoice={() => router.push(routes.newInvoice)}
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
        {notificationPanel}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <MobileAppHeader
        userName={session?.user?.name}
        userRole={(session?.user as { role?: string } | undefined)?.role}
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
      <MobileTabBar pathname={pathname} onNavigate={navigate} t={t} iconColors={iconColors} />
      {notificationPanel}
    </SafeAreaView>
  );
}
