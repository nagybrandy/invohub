// components/notifications/NotificationPanel.tsx
// Native notification panel: a bottom sheet from under the top bar (SPEC
// §7.3, tokens.md §6.15). The web twin (NotificationPanel.web.tsx) shows a
// popover under the bell on desktop and the same sheet on phones; the content
// is shared (NotificationPanelContent).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Sheet } from "@/components/ui/sheet";
import { NotificationPanelContent } from "@/components/notifications/NotificationPanelContent";
import { PHONE_SHEET_TOP_OFFSET, type NotificationPanelProps } from "@/components/notifications/panel-types";

export type { NotificationPanelProps } from "@/components/notifications/panel-types";

export function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      hideHeader
      presentation="sheet"
      topOffset={PHONE_SHEET_TOP_OFFSET}
      accessibilityLabel={t("notifications.panel.title")}
      testID="notification-panel"
    >
      {/* The sheet pads 16px; the panel's own 18px inset runs edge to edge. */}
      <Box className="-mx-4">
        <NotificationPanelContent
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onClose={onClose}
        />
      </Box>
    </Sheet>
  );
}
