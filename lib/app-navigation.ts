// lib/app-navigation.ts
// Shared nav structure: desktop sidebar, mobile tabs + "Továbbiak" sheet, and feature hubs.
import type { LucideIcon } from "lucide-react-native";
import {
  Download,
  Layers,
  FileText,
  House,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Settings,
  Shield,
  Upload,
  Users,
  MailOpen,
} from "lucide-react-native";
import { routes, type AppRoute } from "@/lib/navigation";
import { isAdmin } from "@/lib/user-roles";
import { isInvoiceImportEnabled } from "@/lib/import/import-flag";

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
 * daily-work order (brief 2026-09-14): Főoldal, Számlák, Nyugták,
 * Partnerek, Termékek, Beállítások.
 */
export const SIDEBAR_PRIMARY_NAV: AppNavItem[] = [
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: House },
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { href: routes.receipts, labelKey: "nav.receipts", icon: Receipt },
  { href: routes.clients, labelKey: "nav.partners", icon: Users },
  { href: routes.products, labelKey: "nav.products", icon: Package },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

/** Desktop sidebar — secondary items below the divider (Importálás, Admin). */
export const SIDEBAR_SECONDARY_NAV: AppNavItem[] = [
  { href: routes.emailEditor, labelKey: "nav.emailEditor", icon: MailOpen },
  { href: routes.dataExport, labelKey: "nav.dataExport", icon: Download },
  { href: routes.bulkUpload, labelKey: "nav.bulkUpload", icon: Layers },
  { href: routes.import, labelKey: "nav.import", icon: Upload },
];

/** Which flagged features this deploy shows; defaults read the env flags. */
export type NavFeatures = { importEnabled?: boolean };

function defaultFeatures(): NavFeatures {
  return { importEnabled: isInvoiceImportEnabled() };
}

// The spreadsheet import stays in the constants (they describe the full
// product) but leaves every rendered list unless the deploy turned it on.
function withFeatures(items: AppNavItem[], features: NavFeatures): AppNavItem[] {
  return features.importEnabled ? items : items.filter((item) => item.href !== routes.import);
}

export function getSidebarSecondaryNav(
  role: string | undefined,
  features: NavFeatures = defaultFeatures(),
): AppNavItem[] {
  const base = withFeatures(SIDEBAR_SECONDARY_NAV, features);
  return isAdmin(role) ? [...base, ADMIN_NAV] : base;
}

/**
 * Phone bottom tab bar (SPEC §5.4): Főoldal, Számlák, **Új**, Partnerek,
 * Továbbiak. Two entries carry no `href`: `action: "new"` opens the Új sheet
 * (Új számla / Új nyugta) and `action: "more"` opens the "Továbbiak" sheet, so
 * Nyugták/Termékek/Beállítások stay one tap away without crowding the bar.
 */
export type MobileTabItem = {
  labelKey: string;
  icon: LucideIcon;
  href?: AppRoute;
  action?: "new" | "more";
};

export const MOBILE_TAB_NAV: MobileTabItem[] = [
  { href: routes.dashboard, labelKey: "nav.dashboard", icon: House },
  { href: routes.invoices, labelKey: "nav.invoices", icon: FileText },
  { labelKey: "nav.newShort", icon: Plus, action: "new" },
  { href: routes.clients, labelKey: "nav.partners", icon: Users },
  { labelKey: "nav.more", icon: MoreHorizontal, action: "more" },
];

/** Items inside the mobile "Továbbiak" sheet (sign-out is rendered by the
 * sheet itself as a separate action, not a nav route). */
export const MOBILE_MORE_NAV: AppNavItem[] = [
  { href: routes.receipts, labelKey: "nav.receipts", icon: Receipt },
  { href: routes.products, labelKey: "nav.products", icon: Package },
  { href: routes.emailEditor, labelKey: "nav.emailEditor", icon: MailOpen },
  { href: routes.dataExport, labelKey: "nav.dataExport", icon: Download },
  { href: routes.bulkUpload, labelKey: "nav.bulkUpload", icon: Layers },
  { href: routes.import, labelKey: "nav.import", icon: Upload },
  { href: routes.settings, labelKey: "nav.settings", icon: Settings },
];

export function getMobileMoreNav(
  role: string | undefined,
  features: NavFeatures = defaultFeatures(),
): AppNavItem[] {
  const base = withFeatures(MOBILE_MORE_NAV, features);
  return isAdmin(role) ? [...base, ADMIN_NAV] : base;
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

export function getDashboardFeatures(
  role: string | undefined,
  features: NavFeatures = defaultFeatures(),
): AppNavItem[] {
  const base = withFeatures(DASHBOARD_FEATURE_NAV, features);
  return isAdmin(role) ? [...base, ADMIN_NAV] : base;
}

/**
 * Settings sub-pages get a topstrip breadcrumb back to the hub (N9) — the
 * hub itself (`/settings`) does not, per the "no breadcrumb on top-level
 * screens" rule (spec §1.3).
 */
const SETTINGS_SUBPAGES: { path: AppRoute; labelKey: string }[] = [
  { path: routes.settingsCompany, labelKey: "settings.company" },
  { path: routes.settingsBilling, labelKey: "settings.billing" },
  { path: routes.settingsAccess, labelKey: "settings.access" },
  { path: routes.settingsTemplates, labelKey: "settings.templates" },
  { path: routes.settingsPdf, labelKey: "settings.pdf" },
  { path: routes.settingsReminders, labelKey: "settings.reminders" },
  { path: routes.settingsApiKeys, labelKey: "settings.apiKeys" },
  { path: routes.settingsAppearance, labelKey: "nav.settingsAppearance" },
  { path: routes.settingsNav, labelKey: "nav.settingsNav" },
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

// ---------------------------------------------------------------------------
// Breadcrumbs (SPEC §5.6)
// ---------------------------------------------------------------------------

export type BreadcrumbTrailItem = { label: string; href?: AppRoute };

type TranslateFn = (key: string) => string;

export type BreadcrumbOptions = {
  /** Label for the last item when the screen knows better than the route (e.g. an invoice number). */
  currentLabel?: string;
  /** Prepend "Főoldal" (the composer pages show "Főoldal / Számlák / Új számla"). */
  includeHome?: boolean;
};

/** Collection routes whose subpages get a trail, with the label of the singular record. */
const BREADCRUMB_SECTIONS: Array<{
  base: string;
  listRoute: AppRoute;
  listKey: string;
  recordKey: string;
  newPath?: string;
}> = [
  { base: "/invoices", listRoute: routes.invoices, listKey: "nav.invoices", recordKey: "nav.breadcrumb.invoice", newPath: "/invoices/new" },
  { base: "/receipts", listRoute: routes.receipts, listKey: "nav.receipts", recordKey: "nav.breadcrumb.receipt", newPath: "/receipts/new" },
  { base: "/clients", listRoute: routes.clients, listKey: "nav.partners", recordKey: "nav.breadcrumb.partner", newPath: "/clients/new" },
  { base: "/products", listRoute: routes.products, listKey: "nav.products", recordKey: "nav.breadcrumb.product", newPath: "/products/new" },
];

/**
 * The breadcrumb trail for a subpage route, or undefined for top-level screens
 * (Főoldal, Számlák, Nyugták, Partnerek, Termékek, the Beállítások start page,
 * the secondary tools) which have none. Screens pass the result to
 * `PageHeader`; on phones the Breadcrumb collapses to a "‹ Parent" link.
 *
 *   /invoices/new            Számlák › Új
 *   /invoices/:id            Számlák › Számla            (currentLabel = the number)
 *   /invoices/:id/edit       Számlák › Számla › Szerkesztés
 *   /settings/company        Beállítások › Céges profil
 */
export function getBreadcrumb(
  pathname: string,
  t: TranslateFn,
  options: BreadcrumbOptions = {},
): BreadcrumbTrailItem[] | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  const home: BreadcrumbTrailItem[] = options.includeHome ? [{ label: t("nav.dashboard"), href: routes.dashboard }] : [];

  const settingsKey = getSettingsBreadcrumbLabelKey(path);
  if (settingsKey) {
    return [...home, { label: t("nav.settings"), href: routes.settings }, { label: options.currentLabel ?? t(settingsKey) }];
  }

  // Ismétlődő számlák live under /invoices but are not invoice records, so
  // /invoices/recurring/* must not be read as "/invoices/:id".
  if (path === "/invoices/recurring" || path.startsWith("/invoices/recurring/")) {
    const invoicesCrumb: BreadcrumbTrailItem = { label: t("nav.invoices"), href: routes.invoices };
    const recurringLabel = t("nav.recurringInvoices");
    if (path === "/invoices/recurring") return [...home, invoicesCrumb, { label: recurringLabel }];
    const leaf =
      path === "/invoices/recurring/new" ? t("nav.breadcrumb.new") : t("nav.breadcrumb.edit");
    return [
      ...home,
      invoicesCrumb,
      { label: recurringLabel, href: routes.recurringInvoices },
      { label: options.currentLabel ?? leaf },
    ];
  }

  for (const section of BREADCRUMB_SECTIONS) {
    if (path === section.base || !path.startsWith(`${section.base}/`)) continue;
    const rest = path.slice(section.base.length + 1).split("/");
    const list: BreadcrumbTrailItem = { label: t(section.listKey), href: section.listRoute };
    if (section.newPath && path === section.newPath) {
      return [...home, list, { label: options.currentLabel ?? t("nav.breadcrumb.new") }];
    }
    if (rest.length === 1) {
      // detail page, e.g. /invoices/:id
      return [...home, list, { label: options.currentLabel ?? t(section.recordKey) }];
    }
    if (rest.length === 2 && rest[1] === "edit") {
      const record = options.currentLabel ?? t(section.recordKey);
      // Partners and products have no detail page: their edit page IS the record.
      if (section.base === "/clients" || section.base === "/products") return [...home, list, { label: record }];
      return [
        ...home,
        list,
        { label: record, href: `${section.base}/${rest[0]}` as AppRoute },
        { label: t("nav.breadcrumb.edit") },
      ];
    }
  }
  return undefined;
}
