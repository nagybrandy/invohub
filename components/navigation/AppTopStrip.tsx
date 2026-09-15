// components/navigation/AppTopStrip.tsx
// 56px top strip: sidebar collapse toggle + breadcrumb (or page title) on
// the left, notifications / language / user menu on the right. The desktop
// shell's only other chrome besides the sidebar — it never carries primary
// nav itself (spec §1.1). The collapse toggle lives here (not inside the
// sidebar) so it's reachable and visible regardless of collapsed state, and
// so this strip isn't left empty on the many top-level screens that don't
// get a breadcrumb.
import { Bell, PanelLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { UserMenu } from "@/components/navigation/UserMenu";
import { useIconColors } from "@/lib/theme/icon-colors";

export type AppTopStripProps = {
  breadcrumb?: BreadcrumbItem[];
  /** Translation key for the current section's title (e.g. "nav.invoices"),
   * shown in place of the breadcrumb on top-level screens that don't have
   * one, so the strip isn't left empty. */
  pageTitleLabelKey?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  userName?: string;
  companyName?: string;
  onOpenAccount: () => void;
  onOpenCompany: () => void;
  onSignOut: () => void;
};

export function AppTopStrip({
  breadcrumb,
  pageTitleLabelKey,
  collapsed,
  onToggleCollapsed,
  unreadCount,
  onOpenNotifications,
  userName,
  companyName,
  onOpenAccount,
  onOpenCompany,
  onSignOut,
}: AppTopStripProps) {
  const { t } = useTranslation();
  const icons = useIconColors();

  return (
    <Box
      className="relative z-10 h-14 border-b border-border bg-card px-6"
      // The bell/user-menu popovers are absolutely positioned inside this
      // strip. Every RN-Web View gets its own z-index:0 stacking context by
      // default, so without a z-index HERE (above the main content area's
      // own default stacking context, which sits later in the DOM) those
      // popovers would paint UNDER the page content instead of over it.
    >
      <HStack className="h-14 items-center justify-between">
        <HStack space="sm" className="items-center">
          <Pressable
            onPress={onToggleCollapsed}
            accessibilityRole="button"
            accessibilityLabel={t(collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
            className="h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
          >
            <PanelLeft size={18} color={icons.muted} />
          </Pressable>

          <Box testID="app-topstrip-breadcrumb">
            {breadcrumb && breadcrumb.length > 0 ? (
              <Breadcrumb items={breadcrumb} />
            ) : pageTitleLabelKey ? (
              <Text className="text-base font-semibold text-foreground">
                {t(pageTitleLabelKey)}
              </Text>
            ) : null}
          </Box>
        </HStack>

        <HStack space="md" className="items-center">
          <Pressable
            onPress={onOpenNotifications}
            accessibilityRole="button"
            accessibilityLabel={t("nav.notifications")}
            className="relative rounded-full p-2 hover:bg-muted"
          >
            <Bell size={20} color={icons.muted} />
            {unreadCount > 0 ? (
              <Box className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </Box>
            ) : null}
          </Pressable>

          <LanguageSwitcher tone="onLight" />

          <UserMenu
            userName={userName}
            companyName={companyName}
            onOpenAccount={onOpenAccount}
            onOpenCompany={onOpenCompany}
            onSignOut={onSignOut}
          />
        </HStack>
      </HStack>
    </Box>
  );
}
