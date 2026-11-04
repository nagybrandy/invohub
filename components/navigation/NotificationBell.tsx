// components/navigation/NotificationBell.tsx
// The bell with the real unread badge (tokens.md §6.11): 34x34, radius 8,
// badge --err with white 10px text, hidden at 0. The shell only opens and
// closes the notification panel; the home track restyles the panel itself.
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useIconColors } from "@/lib/theme/icon-colors";

export type NotificationBellProps = {
  unreadCount: number;
  onPress: () => void;
  expanded?: boolean;
  testID?: string;
};

export function NotificationBell({
  unreadCount,
  onPress,
  expanded = false,
  testID = "notification-bell",
}: NotificationBellProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? t("nav.notificationsUnread", { count: unreadCount }) : t("nav.notifications")
      }
      accessibilityState={{ expanded }}
      className={`relative h-[34px] w-[34px] phone:h-10 phone:w-10 items-center justify-center rounded-control ${
        expanded ? "bg-neutral-wash" : "data-[hover=true]:bg-neutral-wash"
      }`}
    >
      <Bell size={20} color={icons.foreground} />
      {unreadCount > 0 ? (
        <Box
          testID={`${testID}-badge`}
          className="absolute right-0 top-0 min-w-[16px] items-center justify-center rounded-full bg-err px-[5px] py-px"
        >
          <Text className="text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </Box>
      ) : null}
    </Pressable>
  );
}
