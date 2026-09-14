// components/navigation/UserMenu.tsx
// Avatar in the top strip opens a REAL menu (N4/N3 fix) — previously the
// avatar had no handler and sign-out was buried at the bottom of Settings.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Building2, LogOut, User } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIconColors } from "@/lib/theme/icon-colors";

type UserMenuProps = {
  userName?: string;
  companyName?: string;
  onOpenAccount: () => void;
  onOpenCompany: () => void;
  onSignOut: () => void;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({ userName, onOpenAccount, onOpenCompany, onSignOut }: UserMenuProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [open, setOpen] = React.useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <Box className="relative">
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={t("nav.accountSettings")}
        accessibilityState={{ expanded: open }}
        className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
      >
        <Text className="text-xs font-bold text-white">{initials(userName || "U")}</Text>
      </Pressable>

      {open ? (
        <>
          {/* Oversized backdrop closes the menu on outside click/tap (no
              portal available, so it just needs to cover more than any
              realistic viewport around the anchor). */}
          <Pressable
            onPress={close}
            accessibilityLabel={t("nav.menu")}
            className="absolute -inset-[1000px] z-10"
          />
          <VStack
            className="absolute right-0 top-11 z-20 w-56 gap-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-sm"
          >
            <Pressable
              onPress={() => {
                onOpenAccount();
                close();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={t("userMenu.accountSettings")}
              className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <User size={16} color={icons.muted} />
              <Text className="text-sm text-popover-foreground">
                {t("userMenu.accountSettings")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onOpenCompany();
                close();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={t("userMenu.companyProfile")}
              className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <Building2 size={16} color={icons.muted} />
              <Text className="text-sm text-popover-foreground">
                {t("userMenu.companyProfile")}
              </Text>
            </Pressable>
            <Box className="my-1 h-px bg-border" />
            <Pressable
              onPress={() => {
                onSignOut();
                close();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={t("userMenu.signOut")}
              className="flex-row items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <LogOut size={16} color={icons.destructive} />
              <Text className="text-sm text-destructive">{t("userMenu.signOut")}</Text>
            </Pressable>
          </VStack>
        </>
      ) : null}
    </Box>
  );
}

