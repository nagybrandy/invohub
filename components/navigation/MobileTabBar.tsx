// components/navigation/MobileTabBar.tsx
// Phone bottom tab bar (SPEC §5.4, tokens.md §6.12): Főoldal, Számlák, Új,
// Partnerek, Továbbiak. A five-column grid `1fr 1fr 1.45fr 1fr 1fr`, so the
// gaps between the five SHAPES are equal even though the centre "Új" pill
// (56x32, primary, white "+") is wider than an icon. "Új" opens the Új sheet,
// "Továbbiak" the more sheet; the other three navigate. Active = primary,
// others muted; labels 11px 600.
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { isNavActive, MOBILE_TAB_NAV, type MobileTabItem } from "@/lib/app-navigation";
import type { AppRoute } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export type MobileTabBarProps = {
  pathname: string;
  onNavigate: (href: AppRoute) => void;
  onOpenNew: () => void;
  onOpenMore: () => void;
  newOpen?: boolean;
  moreOpen?: boolean;
};

/** Column weights of the grid: the centre column is 1.45x so the gaps between shapes match. */
export const TAB_COLUMN_FLEX = [1, 1, 1.45, 1, 1] as const;

export function MobileTabBar({
  pathname,
  onNavigate,
  onOpenNew,
  onOpenMore,
  newOpen = false,
  moreOpen = false,
}: MobileTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const icons = useIconColors();

  function press(item: MobileTabItem) {
    if (item.href) onNavigate(item.href);
    else if (item.action === "new") onOpenNew();
    else onOpenMore();
  }

  return (
    <Box
      testID="mobile-tab-bar"
      role="navigation"
      aria-label={t("shell.tabs.label")}
      className="border-t border-line bg-surface px-1 pt-1.5 shadow-tabbar"
      style={{ paddingBottom: 6 + insets.bottom }}
    >
      <Box className="flex-row">
        {MOBILE_TAB_NAV.map((item, index) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const isNew = item.action === "new";
          const active = item.href ? isNavActive(pathname, item.href as string) : false;
          const open = item.action === "new" ? newOpen : item.action === "more" ? moreOpen : false;
          const tone = isNew || active || open ? "text-primary" : "text-muted-ink";
          return (
            <Box
              key={item.labelKey}
              className="items-stretch"
              style={{ flexGrow: TAB_COLUMN_FLEX[index], flexBasis: 0, minWidth: 0 }}
            >
              <Pressable
                testID={isNew ? "tab-new" : `tab-${item.labelKey.replace("nav.", "")}`}
                onPress={() => press(item)}
                accessibilityRole={item.href ? "link" : "button"}
                accessibilityLabel={label}
                accessibilityState={item.href ? { selected: active } : { expanded: open }}
                aria-current={active ? "page" : undefined}
                aria-haspopup={item.href ? undefined : "dialog"}
                className="min-h-[52px] items-center justify-center gap-[3px] rounded-[10px] data-[active=true]:bg-neutral-wash"
              >
                {isNew ? (
                  <Box
                    testID="tab-new-pill"
                    className="h-8 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm data-[active=true]:bg-primary-press"
                  >
                    <Icon size={20} color={icons.onNavyActive} />
                  </Box>
                ) : (
                  <Icon size={24} color={active || open ? icons.primary : icons.muted} />
                )}
                <Text numberOfLines={1} className={`text-[11px] font-semibold ${tone}`}>
                  {label}
                </Text>
              </Pressable>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
