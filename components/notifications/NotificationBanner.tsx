// components/notifications/NotificationBanner.tsx
// Slim 40px alert bar for the latest unread notification — Hungarian text
// from i18n (no hardcode), and dismissable for the session (N7 fix).
import * as React from "react";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import type { AppNotification } from "@/lib/notifications/types";
import { isWeb } from "@/lib/platform";
import { useIconColors } from "@/lib/theme/icon-colors";

const BANNER_DISMISS_STORAGE_KEY = "invohub.banner.dismissed";

function readDismissedId(): string | null {
  if (!isWeb() || typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(BANNER_DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedId(id: string) {
  if (!isWeb() || typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(BANNER_DISMISS_STORAGE_KEY, id);
  } catch {
    // Private browsing / quota exceeded — the banner just won't stay dismissed.
  }
}

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
  const { t } = useTranslation();
  const icons = useIconColors();
  const [dismissedId, setDismissedId] = React.useState<string | null>(() => readDismissedId());

  if (dismissedId === notification.id) {
    return null;
  }

  function handleDismiss() {
    writeDismissedId(notification.id);
    setDismissedId(notification.id);
  }

  return (
    <Box
      testID="notification-banner"
      className="h-10 flex-row items-center border-b border-primary/20 bg-accent px-4"
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="flex-1 flex-row items-center gap-2"
      >
        <Box className="h-2 w-2 rounded-full bg-primary" />
        <Text
          size="sm"
          className="flex-1 text-foreground"
          isTruncated
          {...(isWeb() ? {} : { numberOfLines: 1 })}
        >
          {notification.title}
          {unreadCount > 1 ? ` ${t("notifications.banner.more", { count: unreadCount - 1 })}` : ""}
        </Text>
      </Pressable>
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("notifications.banner.dismiss")}
        hitSlop={8}
        className="ml-2 rounded-full p-1"
      >
        <X size={14} color={icons.muted} />
      </Pressable>
    </Box>
  );
}
