// lib/app-navigation.ts
// Shared nav structure: desktop sidebar, mobile tabs + "Továbbiak" sheet, and feature hubs.
import type { LucideIcon } from "lucide-react-native";
import {
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Settings,
  Shield,
  Upload,
  Users,
} from "lucide-react-native";
import { routes, type AppRoute } from "@/lib/navigation";
import { isAdmin } from "@/lib/user-roles";

export type AppNavItem = {
  href: AppRoute;
  labelKey: string;
  icon: LucideIcon;
  descriptionKey?: string;
  adminOnly?: boolean;
};

/** Admin-only panel link (mobile "Továbbiak" sheet + desktop sidebar). */
export const ADMIN_NAV: AppNavItem = {
  href: routes.admin,
  labelKey: "nav.admin",
  icon: Shield,
  descriptionKey: "admin.subtitle",
  adminOnly: true,
};

/**
 * Desktop sidebar — primary sections above the divider, in the owner's
 * daily-work order (brief 2026-09-14): Vezérlőpult, Számlák, Nyugták,
 * Partnerek, Termékek, Beállítások.
 */
export const SIDEBAR_PRIMARY_NAV: AppNavItem[] = [
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.receipts, labelKey: "nav.receipts", icon: Receipt },
  { href: routes.clients, labelKey: "nav.partners", icon: Users },
  { href: routes.products, labelKey: "nav.products", icon: Package },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

/** Desktop sidebar — secondary items below the divider (Importálás, Admin). */
export const SIDEBAR_SECONDARY_NAV: AppNavItem[] = [
  { href: routes.import, labelKey: "nav.import", icon: Upload },
];

export function getSidebarSecondaryNav(role: string | undefined): AppNavItem[] {
  return isAdmin(role) ? [...SIDEBAR_SECONDARY_NAV, ADMIN_NAV] : SIDEBAR_SECONDARY_NAV;
}

/**
 * Mobile bottom tab bar. The last entry carries no `href` — it opens the
 * "Továbbiak" sheet instead of navigating directly, which is how
 * Nyugták/Termékek/Importálás/Beállítások stay one tap away on mobile
 * without crowding the 5-tab bar (N1 mobile fix).
 */
export type MobileTabItem = {
  labelKey: string;
  icon: LucideIcon;
  href?: AppRoute;
};

export const MOBILE_TAB_NAV: MobileTabItem[] = [
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.clients, labelKey: "nav.partners", icon: Users },
  { href: routes.newInvoice, labelKey: "nav.newInvoice", icon: Plus },
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: LayoutDashboard },
  { labelKey: "nav.more", icon: MoreHorizontal },
];

/** Items inside the mobile "Továbbiak" sheet (sign-out is rendered by the
 * sheet itself as a separate action, not a nav route). */
export const MOBILE_MORE_NAV: AppNavItem[] = [
  { href: routes.receipts, labelKey: "nav.receipts", icon: Receipt },
  { href: routes.products, labelKey: "nav.products", icon: Package },
  { href: routes.import, labelKey: "nav.import", icon: Upload },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

export function getMobileMoreNav(role: string | undefined): AppNavItem[] {
  return isAdmin(role) ? [...MOBILE_MORE_NAV, ADMIN_NAV] : MOBILE_MORE_NAV;
}

/** Secondary features for the dashboard's "gyors ugrás" quick-jump cards. */
export const DASHBOARD_FEATURE_NAV: AppNavItem[] = [
  {
    href: routes.products,
    labelKey: "nav.products",
    icon: Package,
    descriptionKey: "dashboard.features.products",
  },
  {
    href: routes.receipts,
    labelKey: "nav.receipts",
    icon: Receipt,
    descriptionKey: "dashboard.features.receipts",
  },
  {
    href: routes.import,
    labelKey: "nav.import",
    icon: Upload,
    descriptionKey: "dashboard.features.import",
  },
];

export function getDashboardFeatures(role: string | undefined): AppNavItem[] {
  const showAdmin = isAdmin(role);
  return showAdmin ? [...DASHBOARD_FEATURE_NAV, ADMIN_NAV] : [...DASHBOARD_FEATURE_NAV];
}

/**
 * Settings sub-pages get a topstrip breadcrumb back to the hub (N9) — the
 * hub itself (`/settings`) does not, per the "no breadcrumb on top-level
 * screens" rule (spec §1.3).
 */
const SETTINGS_SUBPAGES: { path: AppRoute; labelKey: string }[] = [
  { path: routes.settingsCompany, labelKey: "settings.company" },
  { path: routes.settingsTemplates, labelKey: "settings.templates" },
  { path: routes.settingsPdf, labelKey: "settings.pdf" },
  { path: routes.settingsReminders, labelKey: "settings.reminders" },
  { path: routes.settingsApiKeys, labelKey: "settings.apiKeys" },
];

export function getSettingsBreadcrumbLabelKey(pathname: string): string | undefined {
  const match = SETTINGS_SUBPAGES.find(
    (s) => pathname === (s.path as string) || pathname.startsWith(`${s.path as string}/`),
  );
  return match?.labelKey;
}

/**
 * Desktop top strip page title (fills the space to the left of the
 * notifications/user menu on screens that don't get a breadcrumb — every
 * top-level screen). Reuses the same sidebar labelKeys and active-match
 * rules so the title always agrees with whichever sidebar row is lit up.
 */
const NAV_ITEMS_FOR_TITLE: AppNavItem[] = [...SIDEBAR_PRIMARY_NAV, ...SIDEBAR_SECONDARY_NAV, ADMIN_NAV];

export function getPageTitleLabelKey(pathname: string): string | undefined {
  return NAV_ITEMS_FOR_TITLE.find((item) => isNavActive(pathname, item.href as string))?.labelKey;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === routes.dashboard) return pathname === "/dashboard";
  if (href === routes.settings) return pathname.startsWith("/settings");
  if (href === routes.admin) return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}
