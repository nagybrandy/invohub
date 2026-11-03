// lib/settings-navigation.ts
// The Beállítások navigation: one list drives the left nav (>= 860px pane),
// the grouped start list on phones and the search over both (SPEC §9.1,
// tokens.md §6.17). Routes come from lib/navigation.ts; the labels are
// `settingsPages.items.<key>.title/description`.
import type { Href } from "expo-router";
import {
  Building2,
  Calculator,
  FileText,
  Globe,
  KeyRound,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { routes } from "@/lib/navigation";

export type SettingsNavKey =
  | "company"
  | "billing"
  | "pdf"
  | "templates"
  | "reminders"
  | "nav"
  | "access"
  | "appearance"
  | "apiKeys";

export type SettingsNavItem = {
  key: SettingsNavKey;
  href: Href;
  /** Plain pathname, for matching the current route. */
  path: string;
  icon: LucideIcon;
  /** `main` rows come first; `after` rows sit below the divider (API kulcsok). */
  group: "main" | "after";
};

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { key: "company", href: routes.settingsCompany, path: "/settings/company", icon: Building2, group: "main" },
  { key: "billing", href: routes.settingsBilling, path: "/settings/billing", icon: Calculator, group: "main" },
  { key: "pdf", href: routes.settingsPdf, path: "/settings/pdf", icon: FileText, group: "main" },
  { key: "templates", href: routes.settingsTemplates, path: "/settings/templates", icon: Mail, group: "main" },
  { key: "reminders", href: routes.settingsReminders, path: "/settings/reminders", icon: MessageSquare, group: "main" },
  { key: "nav", href: routes.settingsNav, path: "/settings/nav", icon: ShieldCheck, group: "main" },
  { key: "access", href: routes.settingsAccess, path: "/settings/access", icon: Users, group: "main" },
  { key: "appearance", href: routes.settingsAppearance, path: "/settings/appearance", icon: Globe, group: "main" },
  { key: "apiKeys", href: routes.settingsApiKeys, path: "/settings/api-keys", icon: KeyRound, group: "after" },
];

/** i18n keys for a nav item. */
export function settingsItemKeys(key: SettingsNavKey) {
  return {
    title: `settingsPages.items.${key}.title`,
    description: `settingsPages.items.${key}.description`,
    lead: `settingsPages.items.${key}.lead`,
  };
}

/** The nav item a pathname belongs to (the e-mail editor counts as "templates"). */
export function settingsNavKeyForPath(pathname: string): SettingsNavKey | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/email-editor") return "templates";
  return SETTINGS_NAV_ITEMS.find((item) => path === item.path || path.startsWith(`${item.path}/`))?.key;
}

/** Lower-case and strip accents so "szamla" finds "Számla". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Items whose title or one-line description contains the query (accent- and
 * case-insensitive). An empty query keeps everything.
 */
export function filterSettingsNav(
  items: readonly SettingsNavItem[],
  query: string,
  t: (key: string) => string,
): SettingsNavItem[] {
  const needle = normalizeSearch(query);
  if (!needle) return [...items];
  return items.filter((item) => {
    const keys = settingsItemKeys(item.key);
    return normalizeSearch(`${t(keys.title)} ${t(keys.description)}`).includes(needle);
  });
}
