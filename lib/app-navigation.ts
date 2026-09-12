// lib/app-navigation.ts
// Shared nav structure: EV-first mobile tabs, desktop chrome, and feature hubs.
import type { LucideIcon } from "lucide-react-native";
import {
  FileText,
  LayoutDashboard,
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

/**
 * Primary mobile tabs ordered for egyéni vállalkozó daily work:
 * invoices → clients → new invoice (center) → overview → settings.
 */
export const MOBILE_TAB_NAV: AppNavItem[] = [
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.clients, labelKey: "nav.clients", icon: Users },
  { href: routes.newInvoice, labelKey: "nav.newInvoice", icon: Plus },
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

/** Secondary features for EV/accountant hubs (not in the bottom tabs). */
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

/** Admin-only panel link (settings hub + desktop sidebar). */
export const ADMIN_NAV: AppNavItem = {
  href: routes.admin,
  labelKey: "nav.admin",
  icon: Shield,
  descriptionKey: "admin.subtitle",
  adminOnly: true,
};

/** Desktop top nav — invoices first for EV billing workflows. */
export const DESKTOP_TOP_NAV: AppNavItem[] = [
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

/** Desktop sidebar — tabs + secondary features in one list. */
export function getDesktopNavItems(role: string | undefined): AppNavItem[] {
  const showAdmin = isAdmin(role);
  return [
    ...MOBILE_TAB_NAV.filter((item) => item.href !== routes.settings),
    ...DASHBOARD_FEATURE_NAV,
    ...(showAdmin ? [ADMIN_NAV] : []),
    MOBILE_TAB_NAV.find((item) => item.href === routes.settings)!,
  ];
}

export function getDashboardFeatures(role: string | undefined): AppNavItem[] {
  const showAdmin = isAdmin(role);
  return showAdmin ? [...DASHBOARD_FEATURE_NAV, ADMIN_NAV] : [...DASHBOARD_FEATURE_NAV];
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === routes.dashboard) return pathname === "/dashboard";
  if (href === routes.settings) return pathname.startsWith("/settings");
  if (href === routes.admin) return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}
