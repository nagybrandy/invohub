// components/navigation/AppSidebar.tsx
// Persistent navy sidebar for widths above the phone breakpoint (SPEC §5.1,
// tokens.md §6.10). Navy in BOTH themes. Top to bottom: head (logo +
// wordmark, collapse toggle), the split create button, the six primary rows
// (Főoldal, Számlák, Nyugták, Partnerek, Termékek, Beállítások), a divider,
// the real secondary rows (getSidebarSecondaryNav), and the account button in
// the footer. 248px wide, 72px collapsed (icons with tooltips). The overlays
// on the navy are the only hard-coded translucent whites in the app chrome.
import * as React from "react";
import { PanelLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Tooltip } from "@/components/ui/tooltip";
import { BrandLogo } from "@/components/marketing/BrandLogo";
import { NewCreateButton } from "@/components/navigation/NewCreateButton";
import {
  getSidebarSecondaryNav,
  isNavActive,
  SIDEBAR_PRIMARY_NAV,
  type AppNavItem,
} from "@/lib/app-navigation";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import type { AppRoute } from "@/lib/navigation";

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
  const icons = useIconColors();
  const Icon = item.icon;
  const label = t(item.labelKey);
  const row = (
    <Pressable
      testID={`sidebar-nav-${item.labelKey.replace("nav.", "")}`}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-current={active ? "page" : undefined}
      className={`min-h-10 flex-row items-center gap-3 rounded-control ${
        collapsed ? "justify-center px-0 py-[11px]" : "px-3 py-[9px]"
      } ${active ? "bg-white/10" : "data-[hover=true]:bg-white/[0.11]"}`}
    >
      <Icon size={18} color={active ? icons.onNavyActive : icons.onNavy} />
      {collapsed ? null : (
        <Text
          numberOfLines={1}
          className={`flex-1 text-sm font-medium ${active ? "text-white" : "text-navy-ink"}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
  // The rail has no room for labels: they live in a tooltip (hover and focus).
  return collapsed ? (
    <Tooltip content={label} testID={`sidebar-tooltip-${item.labelKey.replace("nav.", "")}`}>
      {row}
    </Tooltip>
  ) : (
    row
  );
}

export type AppSidebarProps = {
  activePathname: string;
  role?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (href: AppRoute) => void;
  onNewInvoice: () => void;
  onNewReceipt: () => void;
  onNewPartner: () => void;
  /** The account button (AccountMenu variant="sidebar"), rendered in the footer. */
  accountMenu: React.ReactNode;
};

export function AppSidebar({
  activePathname,
  role,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onNewInvoice,
  onNewReceipt,
  onNewPartner,
  accountMenu,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const secondaryNav = getSidebarSecondaryNav(role);
  const width = collapsed ? LAYOUT.sidebarCollapsed : LAYOUT.sidebarWidth;

  const logo = (
    <Pressable
      testID="sidebar-logo"
      accessibilityRole="link"
      accessibilityLabel={t("shell.homeLink")}
      onPress={() => onNavigate("/dashboard" as AppRoute)}
      className="flex-row items-center justify-center"
    >
      {/* The real brand lockup on navy: blue tile + white hub mark + white wordmark. */}
      <BrandLogo tone="onDark" height={36} withWordmark={!collapsed} testID="sidebar-logo" />
    </Pressable>
  );

  const toggle = (
    <Pressable
      testID="sidebar-collapse-toggle"
      onPress={onToggleCollapsed}
      accessibilityRole="button"
      accessibilityLabel={t(collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
      accessibilityState={{ expanded: !collapsed }}
      className="h-9 w-9 items-center justify-center rounded-control data-[hover=true]:bg-white/[0.11]"
    >
      <PanelLeft size={18} color={icons.onNavy} />
    </Pressable>
  );

  return (
    <Box
      testID="app-sidebar"
      // `on-navy` flips the global focus ring to white (global.css).
      className="on-navy h-full shrink-0 overflow-hidden bg-navy web:transition-[width] web:duration-[220ms] web:ease-in-out"
      style={{ width }}
    >
      <VStack className={`h-full justify-between py-4 ${collapsed ? "px-2.5" : "px-3"}`}>
        <VStack testID="sidebar-body" className={`gap-3.5 ${collapsed ? "items-center" : ""}`}>
          {collapsed ? (
            <VStack testID="sidebar-head" className="items-center gap-2">
              {logo}
              {toggle}
            </VStack>
          ) : (
            <Box testID="sidebar-head" className="flex-row items-center justify-between px-1">
              {logo}
              {toggle}
            </Box>
          )}

          <NewCreateButton
            collapsed={collapsed}
            onNewInvoice={onNewInvoice}
            onNewReceipt={onNewReceipt}
            onNewPartner={onNewPartner}
          />

          <VStack
            testID="sidebar-nav-primary"
            className={`gap-1 ${collapsed ? "w-full items-center" : ""}`}
            role="navigation"
            aria-label={t("nav.primaryNav")}
          >
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

          <Box className="mx-1 my-1.5 h-px bg-white/[0.12]" />

          <VStack
            testID="sidebar-nav-secondary"
            className={`gap-1 ${collapsed ? "w-full items-center" : ""}`}
            role="navigation"
            aria-label={t("nav.secondaryNav")}
          >
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

        <Box
          testID="sidebar-footer"
          className={`border-t border-white/[0.12] pt-2.5 ${collapsed ? "items-center" : ""}`}
        >
          {accountMenu}
        </Box>
      </VStack>
    </Box>
  );
}
