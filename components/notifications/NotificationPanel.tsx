// components/notifications/NotificationPanel.tsx
// Drawer panel listing all in-app notifications.
import { router } from "expo-router";
import { Bell, CheckCheck, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { translateNotificationText } from "@/lib/notifications/i18n";
import { describeRelativeWhen, type RelativeWhen } from "@/lib/notifications/relative-time";
import type { AppNotification } from "@/lib/notifications/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { TAP_TARGET_ICON_BOX, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
import type { Href } from "expo-router";

type NotificationPanelProps = {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSync: () => void;
};

function renderWhen(descriptor: RelativeWhen, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (descriptor.kind) {
    case "justNow":
      return t("notifications.when.justNow");
    case "minutes":
      return t("notifications.when.minutesAgo", { count: descriptor.count });
    case "hours":
      return t("notifications.when.hoursAgo", { count: descriptor.count });
    case "yesterday":
      return t("notifications.when.yesterday");
    case "absolute":
      return descriptor.date;
  }
}

export function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  onSync,
}: NotificationPanelProps) {
  const icons = useIconColors();
  const { t } = useTranslation();
  // Computed once per render so timestamps don't jump while the panel stays
  // open (§7 of the plan).
  const now = new Date();

  function handleOpen(item: AppNotification) {
    if (!item.read) onMarkRead(item.id);
    onClose();
    if (item.href) {
      router.push(item.href as Href);
    }
  }

  return (
    <Drawer isOpen={open} onClose={onClose} size="lg" anchor="right">
      <DrawerBackdrop />
      <DrawerContent className="w-full max-w-sm p-0">
        <DrawerHeader className="border-b border-border px-4 py-3">
          <HStack className="items-center justify-between">
            <HStack space="sm" className="items-center">
              <Bell size={20} color={icons.accent} />
              <Text className="text-lg font-semibold">{t("notifications.panel.title")}</Text>
              {unreadCount > 0 ? (
                <Badge
                  variant="default"
                  accessibilityLabel={t("notifications.panel.unreadCount", { count: unreadCount })}
                >
                  <BadgeText>{unreadCount}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("notifications.panel.close")}
              className={`items-center justify-center rounded-full ${TAP_TARGET_ICON_BOX}`}
            >
              <X size={20} color={icons.muted} />
            </Pressable>
          </HStack>
        </DrawerHeader>
        <DrawerBody className="flex-1 px-0 py-0">
          <Box className="border-b border-border px-4 py-2">
            <HStack space="sm">
              {unreadCount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={TAP_TARGET_MIN_H}
                  accessibilityLabel={t("notifications.panel.markAllReadA11y")}
                  onPress={() => void onMarkAllRead()}
                >
                  <HStack space="xs" className="items-center">
                    <CheckCheck size={14} color={icons.muted} />
                    <ButtonText>{t("notifications.panel.markAllRead")}</ButtonText>
                  </HStack>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className={TAP_TARGET_MIN_H}
                onPress={() => void onSync()}
              >
                <ButtonText>{t("notifications.panel.refresh")}</ButtonText>
              </Button>
            </HStack>
          </Box>

          {loading ? (
            <Box className="items-center py-12">
              <ActivityIndicator accessibilityLabel={t("notifications.panel.loading")} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box className="items-center px-6 py-12">
              <Bell size={32} color={icons.muted} />
              <Text className="mt-3 text-center font-semibold text-foreground">
                {t("notifications.panel.empty.title")}
              </Text>
              <Text className="mt-1 text-center text-muted-foreground">
                {t("notifications.panel.empty.description")}
              </Text>
            </Box>
          ) : (
            <VStack space="xs" className="py-2">
              {notifications.map((item) => (
                <Pressable key={item.id} onPress={() => handleOpen(item)} className={TAP_TARGET_MIN_H}>
                  <Box
                    className={`border-b border-border px-4 py-3 ${TAP_TARGET_MIN_H} ${item.read ? "bg-background" : "bg-accent/40"}`}
                  >
                    <HStack className="items-start justify-between gap-2">
                      <VStack space="xs" className="flex-1">
                        <Text
                          className={`text-sm ${item.read ? "text-foreground" : "font-semibold text-foreground"}`}
                        >
                          {translateNotificationText(t, item.title, item.referenceKey)}
                        </Text>
                        {item.body ? (
                          <Text size="xs" className="text-muted-foreground">
                            {translateNotificationText(t, item.body, item.referenceKey)}
                          </Text>
                        ) : null}
                        <Text size="xs" className="text-muted-foreground">
                          {renderWhen(describeRelativeWhen(item.createdAt, now), t)}
                        </Text>
                      </VStack>
                      {!item.read ? (
                        <Box className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      ) : null}
                    </HStack>
                  </Box>
                </Pressable>
              ))}
            </VStack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
