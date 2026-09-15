// components/navigation/AppSidebar.tsx
// Persistent desktop navy left sidebar (N1/N5 fix): the only place on desktop
// that carries a real, complete nav — every primary section is one click away.
// Collapse/expand is controlled from outside (the toggle icon lives in
// AppTopStrip — see useSidebarCollapsed) so this component just renders
// narrow or wide for whatever `collapsed` it's given.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Building2, LogOut, Plus } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BrandLogo, BrandMark } from "@/components/marketing/BrandLogo";
import {
  getSidebarSecondaryNav,
  isNavActive,
  SIDEBAR_PRIMARY_NAV,
  type AppNavItem,
} from "@/lib/app-navigation";
import { isWeb } from "@/lib/platform";
import type { AppRoute } from "@/lib/navigation";

// Fixed on-navy ink — the sidebar surface is always the navy `bg-secondary`
// token regardless of app theme, so its icon/text ink stays a constant
// white/near-white rather than following light/dark foreground tokens
// (react-native-svg icons need a literal color, not a CSS var).
const ON_DARK_ACTIVE = "#ffffff";
const ON_DARK_MUTED = "#aab0c6";

function SidebarNavRow({
  item,
  active,
  collapsed,
  onPress,
}: {
  item: AppNavItem;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={t(item.labelKey)}
      className={`h-10 flex-row items-center gap-2 rounded-lg border-l-[3px] px-2.5 hover:bg-white/8 ${
        collapsed ? "justify-center px-0" : ""
      } ${active ? "border-l-primary bg-white/14" : "border-l-transparent"}`}
    >
      <Icon size={20} color={active ? ON_DARK_ACTIVE : ON_DARK_MUTED} />
      {!collapsed ? (
        <Text
          isTruncated
          {...(isWeb() ? {} : { numberOfLines: 1 })}
          className={`text-sm ${
            active ? "font-semibold text-white" : "text-secondary-foreground/75"
          }`}
        >
          {t(item.labelKey)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export type AppSidebarProps = {
  activePathname: string;
  role?: string;
  companyName?: string;
  companyTaxId?: string;
  collapsed: boolean;
  onNavigate: (href: AppRoute) => void;
  onNewInvoice: () => void;
  onOpenCompanySettings: () => void;
  onSignOut: () => void;
};

export function AppSidebar({
  activePathname,
  role,
  companyName,
  companyTaxId,
  collapsed,
  onNavigate,
  onNewInvoice,
  onOpenCompanySettings,
  onSignOut,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const secondaryNav = getSidebarSecondaryNav(role);
  // w-72px/w-248px are Tailwind arbitrary-value classes NativeWind resolves
  // to a real `width`, so a plain CSS `transition-[width]` (web-only utility
  // — no-ops harmlessly on native) animates the collapse/expand smoothly
  // instead of the width snapping instantly.
  const widthClass = collapsed ? "w-[72px]" : "w-[248px]";

  return (
    <Box
      testID="app-sidebar"
      className={`h-full flex-shrink-0 overflow-hidden bg-secondary web:transition-[width] web:duration-200 web:ease-in-out ${widthClass}`}
    >
      <VStack className="h-full justify-between px-3 py-4">
        <VStack space="lg">
          {/* Collapsed: only the mark (no wordmark — it has no room in a
              72px rail and would clip). The collapse/expand toggle itself
              lives in AppTopStrip, not here — see useSidebarCollapsed. */}
          <HStack
            className={`items-center px-1 py-1 ${collapsed ? "justify-center" : "justify-start"}`}
          >
            {collapsed ? (
              <BrandMark tone="onDark" size={24} />
            ) : (
              <BrandLogo tone="onDark" withMark height={24} />
            )}
          </HStack>

          <Pressable
            onPress={onNewInvoice}
            accessibilityRole="button"
            accessibilityLabel={t("nav.newInvoice")}
            className={`h-10 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-3 ${
              collapsed ? "px-0" : ""
            }`}
          >
            <Plus size={18} color="#ffffff" />
            {!collapsed ? (
              <Text className="text-sm font-medium text-primary-foreground">
                {t("nav.newInvoice")}
              </Text>
            ) : null}
          </Pressable>

          <VStack space="xs">
            {SIDEBAR_PRIMARY_NAV.map((item) => (
              <SidebarNavRow
                key={item.href as string}
                item={item}
                active={isNavActive(activePathname, item.href as string)}
                collapsed={collapsed}
                onPress={() => onNavigate(item.href)}
              />
            ))}
          </VStack>

          <Box className="h-px bg-white/10" />

          <VStack space="xs">
            {secondaryNav.map((item) => (
              <SidebarNavRow
                key={item.href as string}
                item={item}
                active={isNavActive(activePathname, item.href as string)}
                collapsed={collapsed}
                onPress={() => onNavigate(item.href)}
              />
            ))}
          </VStack>
        </VStack>

        <VStack space="xs">
          <Box className="h-px bg-white/10" />

          <Pressable
            onPress={onOpenCompanySettings}
            accessibilityRole="button"
            accessibilityLabel={t("nav.companySettings")}
            className={`rounded-lg px-2 py-2 hover:bg-white/8 ${
              collapsed ? "items-center px-0" : ""
            }`}
          >
            {!collapsed ? (
              <VStack>
                <Text
                  className="text-sm font-medium text-white"
                  isTruncated
                  {...(isWeb() ? {} : { numberOfLines: 1 })}
                >
                  {companyName || "InvoHub"}
                </Text>
                {companyTaxId ? (
                  <Text
                    className="text-[10px] font-light text-secondary-foreground/70"
                    isTruncated
                    {...(isWeb() ? {} : { numberOfLines: 1 })}
                  >
                    {companyTaxId}
                  </Text>
                ) : null}
              </VStack>
            ) : (
              <Building2 size={18} color={ON_DARK_MUTED} />
            )}
          </Pressable>

          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel={t("nav.signOut")}
            className={`h-10 flex-row items-center gap-2 rounded-lg px-2 hover:bg-white/8 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut size={18} color={ON_DARK_MUTED} />
            {!collapsed ? (
              <Text className="text-sm text-secondary-foreground/85">{t("nav.signOut")}</Text>
            ) : null}
          </Pressable>
        </VStack>
      </VStack>
    </Box>
  );
}
