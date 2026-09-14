// components/navigation/MobileTabBar.tsx
// Mobile bottom tab bar: Számlák · Partnerek · (+) · Vezérlőpult · Továbbiak.
// Extracted from AppShell so it's independently testable. The center "+" is
// a raised FAB; the last tab has no route — it opens the "Továbbiak" sheet
// so Nyugták/Termékek/Importálás/Beállítások stay one tap away (N1 mobile fix).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isNavActive, MOBILE_TAB_NAV, type MobileTabItem } from "@/lib/app-navigation";
import type { AppRoute } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export type MobileTabBarProps = {
  pathname: string;
  onNavigate: (href: AppRoute) => void;
  onOpenMore: () => void;
};

export function MobileTabBar({ pathname, onNavigate, onOpenMore }: MobileTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const iconColors = useIconColors();

  function press(item: MobileTabItem) {
    if (item.href) {
      onNavigate(item.href);
    } else {
      onOpenMore();
    }
  }

  return (
    <Box
      className="border-t border-border bg-card"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <HStack className="items-end justify-around px-1 pt-2">
        {MOBILE_TAB_NAV.map((item) => {
          const isFab = item.labelKey === "nav.newInvoice";
          const active = item.href ? isNavActive(pathname, item.href as string) : false;
          const Icon = item.icon;
          const label = t(item.labelKey);

          if (isFab) {
            return (
              <Box key={item.labelKey} className="flex-1 items-center">
                <Pressable
                  onPress={() => press(item)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  className="-mt-5 h-[52px] w-[52px] items-center justify-center rounded-full bg-primary shadow-sm"
                >
                  <Icon size={24} color="#ffffff" />
                </Pressable>
              </Box>
            );
          }

          return (
            <Box key={item.labelKey} className="flex-1 items-center">
              <Pressable
                onPress={() => press(item)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                className={`rounded-lg px-2 py-2 ${active ? "bg-primary/15" : ""}`}
              >
                <Icon size={22} color={active ? iconColors.primary : iconColors.muted} />
              </Pressable>
              <Text
                size="xs"
                className={`mt-0.5 text-center ${active ? "font-medium text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
