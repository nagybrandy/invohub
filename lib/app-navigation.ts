// lib/app-navigation.ts
// Shared nav structure: mobile tabs vs dashboard vs settings feature hubs.
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
import { canManageClients, isAdmin } from "@/lib/user-roles";

export type AppNavItem = {
  href: AppRoute;
  labelKey: string;
  icon: LucideIcon;
  descriptionKey?: string;
  accountantOnly?: boolean;
  adminOnly?: boolean;
};

/** Primary mobile bottom tabs — quick access only. */
export const MOBILE_TAB_NAV: AppNavItem[] = [
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.receipts, labelKey: "nav.receipts", icon: Receipt },
  { href: routes.newInvoice, labelKey: "nav.newInvoice", icon: Plus },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

/** Operational features surfaced on Dashboard (not in bottom tabs). */
export const DASHBOARD_FEATURE_NAV: AppNavItem[] = [
  {
    href: routes.import,
    labelKey: "nav.import",
    icon: Upload,
    descriptionKey: "dashboard.features.import",
  },
  {
    href: routes.clients,
    labelKey: "nav.clients",
    icon: Users,
    descriptionKey: "dashboard.features.clients",
    accountantOnly: true,
  },
  {
    href: routes.products,
    labelKey: "nav.products",
    icon: Package,
    descriptionKey: "dashboard.features.products",
    accountantOnly: true,
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

/** Desktop sidebar — tabs + all dashboard features in one list. */
export function getDesktopNavItems(role: string | undefined): AppNavItem[] {
  const showAccountant = canManageClients(role);
  const showAdmin = isAdmin(role);
  return [
    ...MOBILE_TAB_NAV.filter((item) => item.href !== routes.settings),
    ...DASHBOARD_FEATURE_NAV.filter((item) => !item.accountantOnly || showAccountant),
    ...(showAdmin ? [ADMIN_NAV] : []),
    MOBILE_TAB_NAV.find((item) => item.href === routes.settings)!,
  ];
}

export function getDashboardFeatures(role: string | undefined): AppNavItem[] {
  const showAccountant = canManageClients(role);
  const showAdmin = isAdmin(role);
  const features = DASHBOARD_FEATURE_NAV.filter(
    (item) => !item.accountantOnly || showAccountant
  );
  return showAdmin ? [...features, ADMIN_NAV] : features;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === routes.dashboard) return pathname === "/dashboard";
  if (href === routes.settings) return pathname.startsWith("/settings");
  if (href === routes.admin) return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}
