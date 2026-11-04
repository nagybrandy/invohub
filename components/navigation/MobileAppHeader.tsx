// components/navigation/MobileAppHeader.tsx
// Phone top bar (SPEC §5.3, tokens.md §6.11): the account button on the left
// (opens the account menu as a bottom sheet), a search icon and the bell on
// the right. Tapping the search icon turns the whole bar into a full-width
// search field with a close button. No logo, no title.
import * as React from "react";
import { Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GlobalSearchField } from "@/components/navigation/GlobalSearchField";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { useIconColors } from "@/lib/theme/icon-colors";

export type MobileAppHeaderProps = {
  /** The account button (AccountMenu variant="header"). */
  accountMenu: React.ReactNode;
  unreadCount: number;
  onOpenNotifications: () => void;
  notificationsOpen?: boolean;
};

export function MobileAppHeader({
  accountMenu,
  unreadCount,
  onOpenNotifications,
  notificationsOpen = false,
}: MobileAppHeaderProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <Box
      testID="mobile-app-header"
      className="relative z-10 h-14 flex-row items-center gap-2 border-b border-line bg-surface px-3"
    >
      {searchOpen ? (
        <GlobalSearchField variant="phone" autoFocus onClose={() => setSearchOpen(false)} />
      ) : (
        <>
          <Box className="min-w-0 flex-1 items-start">{accountMenu}</Box>
          <Pressable
            testID="mobile-search-button"
            onPress={() => setSearchOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("shell.search.open")}
            className="h-10 w-10 items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash"
          >
            <Search size={20} color={icons.foreground} />
          </Pressable>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={onOpenNotifications}
            expanded={notificationsOpen}
            testID="mobile-notification-bell"
          />
        </>
      )}
    </Box>
  );
}
