// components/navigation/SettingsNav.tsx
// The Beállítások navigation (SPEC §9.1, tokens.md §6.17):
//  - `wide` (the settings frame is >= 860px): a search field and the grouped
//    rows (current row primary-wash, API kulcsok after a divider); the search
//    filters the rows and says so when nothing matches;
//  - otherwise a single "‹ Beállítások" back link to the start list.
import * as React from "react";
import { ChevronLeft } from "lucide-react-native";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { SettingsSearchField } from "@/components/settings/SettingsSearchField";
import { isAccountDeletionUiVisible } from "@/lib/account/deletion-flag";
import { routes } from "@/lib/navigation";
import {
  SETTINGS_NAV_ITEMS,
  filterSettingsNav,
  settingsItemKeys,
  settingsNavKeyForPath,
  type SettingsNavItem,
} from "@/lib/settings-navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export function SettingsBackLink() {
  const { t } = useTranslation();
  const icons = useIconColors();
  return (
    <Pressable
      onPress={() => router.push(routes.settings)}
      accessibilityRole="link"
      accessibilityLabel={t("settingsPages.backToStart")}
      testID="settings-back-link"
      className="min-h-10 flex-row items-center gap-1 self-start rounded-control pr-3 data-[hover=true]:bg-neutral-wash"
    >
      <ChevronLeft size={18} color={icons.muted} />
      <Text className="text-sm font-semibold text-muted-ink">{t("settingsPages.backToStart")}</Text>
    </Pressable>
  );
}

function SettingsNavRow({ item, active }: { item: SettingsNavItem; active: boolean }) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const Icon = item.icon;
  return (
    <Pressable
      testID={`settings-nav-${item.key}`}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      aria-current={active ? "page" : undefined}
      onPress={() => router.push(item.href)}
      className={`flex-row items-center gap-2.5 rounded-control px-2.5 py-[9px] ${
        active ? "bg-primary-wash" : "data-[hover=true]:bg-neutral-wash"
      }`}
    >
      <Box className="h-5 w-5 items-center justify-center">
        <Icon size={18} color={active ? icons.primary : icons.muted} />
      </Box>
      <Text className={`min-w-0 flex-1 text-sm leading-[1.3] ${active ? "font-semibold text-primary-ink" : "font-medium text-ink"}`}>
        {t(settingsItemKeys(item.key).title)}
      </Text>
    </Pressable>
  );
}

/** Feature-flagged (default OFF) row for the deletion request page. */
function AccountDeletionNavRow({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID="settings-nav-account"
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(routes.settingsAccount)}
      className={`mt-2 rounded-control px-2.5 py-[9px] ${active ? "bg-primary-wash" : "data-[hover=true]:bg-neutral-wash"}`}
    >
      <Text className={`text-sm ${active ? "font-semibold text-primary-ink" : "font-medium text-muted-ink"}`}>
        {t("accountDeletion.title")}
      </Text>
    </Pressable>
  );
}

export function SettingsSideNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  const activeKey = settingsNavKeyForPath(pathname ?? "");
  const visible = filterSettingsNav(SETTINGS_NAV_ITEMS, query, t);
  const main = visible.filter((item) => item.group === "main");
  const after = visible.filter((item) => item.group === "after");

  return (
    <Box role="navigation" accessibilityLabel={t("settingsPages.navLabel")} className="w-full gap-3" testID="settings-nav">
      <SettingsSearchField value={query} onChange={setQuery} />

      {visible.length === 0 ? (
        <Text testID="settings-search-empty" className="px-2.5 py-2 text-[13px] text-muted-ink">
          {t("settingsPages.noResults", { query: query.trim() })}
        </Text>
      ) : (
        <Box className="gap-0.5">
          {main.map((item) => (
            <SettingsNavRow key={item.key} item={item} active={item.key === activeKey} />
          ))}
          {main.length > 0 && after.length > 0 ? <Box aria-hidden className="mx-2.5 my-2 h-px bg-line-strong" /> : null}
          {after.map((item) => (
            <SettingsNavRow key={item.key} item={item} active={item.key === activeKey} />
          ))}
          {isAccountDeletionUiVisible() && query.trim() === "" ? <AccountDeletionNavRow active={pathname === "/settings/account"} /> : null}
        </Box>
      )}
    </Box>
  );
}

export function SettingsNav({ wide = false }: { wide?: boolean }) {
  return wide ? <SettingsSideNav /> : <SettingsBackLink />;
}
