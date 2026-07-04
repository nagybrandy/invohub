// components/navigation/AppShell.tsx
// Responsive shell: mobile header + bottom tabs, desktop sidebar + notification panel.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LogOut, Moon, Sun } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Pressable } from "@/components/ui/pressable";
import { Divider } from "@/components/ui/divider";
import { DesktopTopBar } from "@/components/navigation/DesktopTopBar";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { signOut, useSession } from "@/lib/auth-client";
import {
  getDesktopNavItems,
  isNavActive,
  MOBILE_TAB_NAV,
  type AppNavItem,
} from "@/lib/app-navigation";
import { routes, type AppRoute } from "@/lib/navigation";
import { useColorScheme } from "@/lib/useColorScheme";
import { roleLabel } from "@/lib/user-roles";
import { useIconColors } from "@/lib/theme/icon-colors";
import { useNotifications } from "@/hooks/useNotifications";

const DESKTOP_BREAKPOINT = 768;

function NavButton({
  item,
  active,
  onPress,
  compact = false,
  label,
  iconColors,
}: {
  item: AppNavItem;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
  label: string;
  iconColors: ReturnType<typeof useIconColors>;
}) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg px-3 py-2.5 ${active ? "bg-accent" : "bg-transparent active:bg-muted"}`}
    >
      <HStack space="sm" className={`items-center ${compact ? "justify-center" : ""}`}>
        <Icon size={20} color={active ? iconColors.accentForeground : iconColors.muted} />
        {!compact ? (
          <Text
            className={`text-sm font-medium ${active ? "text-accent-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </Text>
        ) : null}
      </HStack>
    </Pressable>
  );
}

function DesktopSidebar({
  pathname,
  items,
  onNavigate,
  onSignOut,
  onToggleTheme,
  isDark,
  userName,
  userRole,
  t,
  iconColors,
}: {
  pathname: string;
  items: AppNavItem[];
  onNavigate: (href: AppRoute) => void;
  onSignOut: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  userName?: string;
  userRole?: string;
  t: (key: string) => string;
  iconColors: ReturnType<typeof useIconColors>;
}) {
  return (
    <VStack className="h-full justify-between">
      <VStack space="lg">
        <HStack space="sm" className="items-center px-2 py-2">
          <Box className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Text className="text-sm font-bold text-primary-foreground">IH</Text>
          </Box>
          <VStack>
            <Heading size="sm" className="text-foreground">
              InvoHub
            </Heading>
            {userName ? (
              <Text size="xs" className="text-muted-foreground">
                {userName}
              </Text>
            ) : null}
            {userRole ? (
              <Text size="xs" className="text-primary">
                {roleLabel(userRole)}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        <Divider />
        <VStack space="xs">
          {items.map((item) => (
            <NavButton
              key={item.labelKey}
              item={item}
              label={t(item.labelKey)}
              active={isNavActive(pathname, item.href as string)}
              onPress={() => onNavigate(item.href)}
              iconColors={iconColors}
            />
          ))}
        </VStack>
      </VStack>
      <VStack space="xs">
        <Pressable onPress={onToggleTheme} className="rounded-lg px-3 py-2.5 active:bg-muted">
          <HStack space="sm" className="items-center">
            {isDark ? <Sun size={20} color={iconColors.muted} /> : <Moon size={20} color={iconColors.muted} />}
            <Text className="text-sm text-muted-foreground">{t("settings.darkMode")}</Text>
          </HStack>
        </Pressable>
        <Pressable onPress={onSignOut} className="rounded-lg px-3 py-2.5 active:bg-muted">
          <HStack space="sm" className="items-center">
            <LogOut size={20} color={iconColors.muted} />
            <Text className="text-sm text-muted-foreground">{t("nav.signOut")}</Text>
          </HStack>
        </Pressable>
      </VStack>
    </VStack>
  );
}

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
                className={`rounded-lg px-2 py-2 ${active ? "bg-accent" : ""}`}
              >
                <Icon size={22} color={active ? iconColors.accentForeground : iconColors.muted} />
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
  const { toggleTheme, isDarkColorScheme } = useColorScheme();
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const desktopItems = getDesktopNavItems(userRole);
  const iconColors = useIconColors();

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
          <Box className="w-64 border-r border-border bg-card p-4">
            <DesktopSidebar
              pathname={pathname}
              items={desktopItems}
              onNavigate={navigate}
              onSignOut={() => void handleSignOut()}
              onToggleTheme={() => void toggleTheme()}
              isDark={isDarkColorScheme}
              userName={session?.user?.name}
              userRole={userRole}
              t={t}
              iconColors={iconColors}
            />
          </Box>
          <Box className="flex-1">
            <DesktopTopBar
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
          </Box>
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
