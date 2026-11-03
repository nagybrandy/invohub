// components/notifications/NotificationPanelContent.tsx
// What is inside the notification panel (SPEC §7.3, tokens.md §6.15), shared
// by the desktop popover and the phone sheet: header ("Értesítések" + "Mind
// olvasott"), the Összes / Olvasatlan (n) segmented control, the Teendők and
// Korábbi groups, and the "Minden elintézve" empty state. One 18px inset for
// the header, tabs, group labels and rows.
//
// Items: icon circle per type, title, body, relative time, an unread dot, and
// ONE inline "Megnyitás" action when the notification has an href. Clicking an
// item marks it read and navigates. No send / resubmit actions (SPEC §11).
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { AlertTriangle, Bell, Check, CheckCheck, Clock, Inbox, Info, Mail } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  groupNotifications,
  isTodoType,
  notificationVisual,
  type NotificationFilter,
  type NotificationIconKind,
  type NotificationTone,
} from "@/components/notifications/notification-groups";
import { translateNotificationText } from "@/lib/notifications/i18n";
import { describeRelativeWhen, type RelativeWhen } from "@/lib/notifications/relative-time";
import type { AppNotification } from "@/lib/notifications/types";
import { useIconColors } from "@/lib/theme/icon-colors";

export type NotificationPanelContentProps = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  /** Closes the panel (called before navigating). */
  onClose: () => void;
  /** Wraps the list; the web popover scrolls only the list, the sheet scrolls everything. */
  renderList?: (list: React.ReactNode) => React.ReactNode;
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function renderWhen(descriptor: RelativeWhen, t: Translate): string {
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

const ICONS: Record<NotificationIconKind, LucideIcon> = {
  triangle: AlertTriangle,
  clock: Clock,
  mail: Mail,
  bell: Bell,
  inbox: Inbox,
  info: Info,
};

const TONE_CIRCLE: Record<NotificationTone, string> = {
  crit: "bg-err-wash",
  warn: "bg-warn-wash",
  low: "bg-neutral-wash",
  ok: "bg-ok-wash",
  info: "bg-primary-wash",
};

export function NotificationPanelContent({
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClose,
  renderList = (list) => list,
}: NotificationPanelContentProps) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [filter, setFilter] = React.useState<NotificationFilter>("all");
  // Computed once per render so timestamps don't jump while the panel stays open.
  const now = new Date();
  const unread = unreadCount;
  const groups = groupNotifications(notifications, filter);
  const empty = groups.todos.length === 0 && groups.earlier.length === 0;

  function toneColor(tone: NotificationTone): string {
    switch (tone) {
      case "crit":
        return icons.destructive;
      case "warn":
        return icons.warn;
      case "ok":
        return icons.ok;
      case "info":
        return icons.primary;
      default:
        return icons.muted;
    }
  }

  function open(item: AppNotification) {
    if (!item.read) onMarkRead(item.id);
    onClose();
    if (item.href) router.push(item.href as Href);
  }

  function renderItem(item: AppNotification) {
    const visual = notificationVisual(item.type);
    const Icon = ICONS[visual.icon];
    const title = translateNotificationText(t, item.title, item.referenceKey);
    const body = item.body ? translateNotificationText(t, item.body, item.referenceKey) : undefined;
    return (
      <Box key={item.id} testID="notification-item" className="relative border-t border-line">
        <Pressable
          testID="notification-item-main"
          accessibilityRole="button"
          accessibilityLabel={[title, body].filter(Boolean).join(". ")}
          onPress={() => open(item)}
          className="px-[18px] pb-1.5 pt-3.5 data-[hover=true]:bg-wash2"
        >
          <HStack className="items-start gap-3">
            <Box className={`h-9 w-9 items-center justify-center rounded-full ${TONE_CIRCLE[visual.tone]}`}>
              <Icon size={18} color={toneColor(visual.tone)} />
            </Box>
            <VStack className="min-w-0 flex-1 pr-4" space="xs">
              <Text className={`text-sm leading-[1.35] text-ink ${item.read ? "font-medium" : "font-semibold"}`}>
                {title}
              </Text>
              {body ? <Text className="text-[13px] text-muted-ink">{body}</Text> : null}
              <Text className="text-xs text-muted-ink">{renderWhen(describeRelativeWhen(item.createdAt, now), t)}</Text>
            </VStack>
          </HStack>
        </Pressable>
        {item.href ? (
          <Box className="pb-3.5 pl-[66px] pr-[18px]">
            <Button
              testID="notification-item-open"
              size="sm"
              variant="secondary"
              className="self-start"
              accessibilityLabel={t("notifications.panel.openA11y", { title })}
              onPress={() => open(item)}
            >
              <ButtonText>{t("notifications.panel.open")}</ButtonText>
            </Button>
          </Box>
        ) : (
          <Box className="h-2" />
        )}
        {!item.read ? (
          <Box
            testID="notification-unread-dot"
            accessibilityLabel={t("notifications.panel.unreadDot")}
            pointerEvents="none"
            className={`absolute right-[18px] top-[19px] h-2 w-2 rounded-full ${
              isTodoType(item.type) ? "bg-err" : "bg-primary"
            }`}
          />
        ) : null}
      </Box>
    );
  }

  const list = loading ? (
    <Box className="items-center py-12">
      <ActivityIndicator accessibilityLabel={t("notifications.panel.loading")} />
    </Box>
  ) : empty ? (
    <Box testID="notification-empty" className="items-center gap-2 px-6 py-10">
      <Box className="h-11 w-11 items-center justify-center rounded-full bg-ok-wash">
        <Check size={22} color={icons.ok} />
      </Box>
      <Text className="text-center text-[15px] font-semibold text-ink">
        {filter === "unread" && notifications.length > 0
          ? t("notifications.panel.empty.unreadTitle")
          : t("notifications.panel.empty.title")}
      </Text>
      {notifications.length === 0 ? (
        <Text className="text-center text-[13px] text-muted-ink">{t("notifications.panel.empty.description")}</Text>
      ) : null}
    </Box>
  ) : (
    <VStack testID="notification-list">
      {groups.todos.length > 0 ? (
        <VStack testID="notification-group-todos">
          <Text className="px-[18px] pb-2 pt-3.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            {t("notifications.panel.groupTodos")}
          </Text>
          {groups.todos.map(renderItem)}
        </VStack>
      ) : null}
      {groups.earlier.length > 0 ? (
        <VStack testID="notification-group-earlier">
          <Text className="px-[18px] pb-2 pt-3.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            {t("notifications.panel.groupEarlier")}
          </Text>
          {groups.earlier.map(renderItem)}
        </VStack>
      ) : null}
    </VStack>
  );

  return (
    <VStack className="min-h-0 w-full flex-shrink">
      <HStack className="items-center justify-between gap-3 px-[18px] pb-2 pt-4">
        <Heading className="font-heading text-base font-bold text-ink">{t("notifications.panel.title")}</Heading>
        <Button
          testID="notification-mark-all-read"
          size="sm"
          variant="tertiary"
          isDisabled={unread === 0}
          accessibilityLabel={t("notifications.panel.markAllReadA11y")}
          onPress={() => void onMarkAllRead()}
        >
          <CheckCheck size={14} color={unread === 0 ? icons.faint : icons.primary} />
          <ButtonText className={unread === 0 ? "text-faint" : undefined}>
            {t("notifications.panel.markAllRead")}
          </ButtonText>
        </Button>
      </HStack>
      <Box className="px-[18px] pb-1">
        <SegmentedControl<NotificationFilter>
          testID="notification-filter"
          size="md"
          fullWidth
          accessibilityLabel={t("notifications.panel.filterLabel")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("notifications.panel.tabAll"), testID: "notification-tab-all" },
            {
              value: "unread",
              label: t("notifications.panel.tabUnread", { count: unread }),
              testID: "notification-tab-unread",
            },
          ]}
        />
      </Box>
      {renderList(list)}
    </VStack>
  );
}
