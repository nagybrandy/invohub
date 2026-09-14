// components/navigation/MoreSheet.tsx
// Mobile "Továbbiak" bottom sheet: everything the desktop sidebar carries
// that doesn't fit the 5-tab bar — Nyugták, Termékek, Importálás,
// Beállítások, Admin (if admin) and Kijelentkezés (N1 mobile fix).
import { LogOut } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getMobileMoreNav } from "@/lib/app-navigation";
import type { AppRoute } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

export type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  role?: string;
  onNavigate: (href: AppRoute) => void;
  onSignOut: () => void;
};

export function MoreSheet({ open, onClose, role, onNavigate, onSignOut }: MoreSheetProps) {
  const { t } = useTranslation();
  const icons = useIconColors();

  if (!open) return null;

  const items = getMobileMoreNav(role);

  return (
    <Box testID="more-sheet" className="absolute inset-0 z-50">
      <Pressable
        onPress={onClose}
        accessibilityLabel={t("nav.menu")}
        className="absolute inset-0 bg-black/40"
      />
      <VStack className="absolute inset-x-0 bottom-0 gap-0.5 rounded-t-2xl bg-card p-2 pb-6 shadow-sm">
        <Box className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-muted" />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.href as string}
              onPress={() => {
                onNavigate(item.href);
                onClose();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={t(item.labelKey)}
              className="h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-muted"
            >
              <Icon size={20} color={icons.muted} />
              <Text className="text-base text-foreground">{t(item.labelKey)}</Text>
            </Pressable>
          );
        })}
        <Box className="my-1 h-px bg-border" />
        <Pressable
          onPress={() => {
            onSignOut();
            onClose();
          }}
          accessibilityRole="menuitem"
          accessibilityLabel={t("nav.signOut")}
          className="h-12 flex-row items-center gap-3 rounded-lg px-3 active:bg-muted"
        >
          <LogOut size={20} color={icons.destructive} />
          <Text className="text-base text-destructive">{t("nav.signOut")}</Text>
        </Pressable>
      </VStack>
    </Box>
  );
}
