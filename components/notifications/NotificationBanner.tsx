// components/notifications/NotificationBanner.tsx
// Slim alert bar for the latest unread notification.
import { ChevronRight } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import type { AppNotification } from "@/lib/notifications/types";
import { useIconColors } from "@/lib/theme/icon-colors";

type NotificationBannerProps = {
  notification: AppNotification;
  onPress: () => void;
  unreadCount: number;
};

export function NotificationBanner({
  notification,
  onPress,
  unreadCount,
}: NotificationBannerProps) {
  const icons = useIconColors();

  return (
    <Pressable onPress={onPress}>
      <Box className="border-b border-primary/20 bg-accent px-4 py-2.5">
        <HStack space="sm" className="items-center">
          <Box className="h-2 w-2 rounded-full bg-primary" />
          <Text size="sm" className="flex-1 text-foreground" numberOfLines={1}>
            {notification.title}
            {unreadCount > 1 ? ` (+${unreadCount - 1} more)` : ""}
          </Text>
          <ChevronRight size={16} color={icons.accent} />
        </HStack>
      </Box>
    </Pressable>
  );
}
