// components/notifications/NotificationPanel.web.tsx
// Web notification panel (SPEC §7.3, tokens.md §6.15):
//   - up to 700px wide: the foundation Sheet, from under the top bar to the bottom;
//   - above: a popover under the bell (fixed top 62, right 16, 420 wide,
//     radius 14). It is a plain DOM portal so it can close on Esc / outside
//     click, keep Tab inside, and give focus back to the bell it was opened from.
// A click on the bell while the popover is open closes it (the shell's bell
// only ever "opens", so the toggle is handled here, before the bell sees it).
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Sheet } from "@/components/ui/sheet";
import { NotificationPanelContent } from "@/components/notifications/NotificationPanelContent";
import { PHONE_SHEET_TOP_OFFSET, type NotificationPanelProps } from "@/components/notifications/panel-types";
import { focusInitial, rememberFocus, trapTab } from "@/lib/ui/focus-trap";
import { LAYOUT } from "@/lib/theme/layout";

const { createPortal } = require("react-dom") as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

export type { NotificationPanelProps } from "@/components/notifications/panel-types";

/** testID of the bell in components/navigation/NotificationBell.tsx. */
const BELL_SELECTOR = '[data-testid="notification-bell"]';

export function NotificationPanel(props: NotificationPanelProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { open, onClose, notifications, unreadCount, loading, onMarkRead, onMarkAllRead } = props;

  const content = (renderList?: (list: React.ReactNode) => React.ReactNode) => (
    <NotificationPanelContent
      notifications={notifications}
      unreadCount={unreadCount}
      loading={loading}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
      onClose={onClose}
      renderList={renderList}
    />
  );

  if (width <= LAYOUT.phoneMax) {
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
        <Box className="-mx-4">{content()}</Box>
      </Sheet>
    );
  }

  return (
    <NotificationPopover open={open} onClose={onClose} label={t("notifications.panel.title")}>
      {content((list) => <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>)}
    </NotificationPopover>
  );
}

function NotificationPopover({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    const restoreFocus = rememberFocus();
    const focusTimer = setTimeout(() => {
      if (panelRef.current) focusInitial(panelRef.current);
    }, 0);

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      // Inside the panel, or on the bell (its click handler below toggles).
      if (panelRef.current?.contains(target) || target.closest?.(BELL_SELECTOR)) return;
      onCloseRef.current();
    }
    function onBellClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target?.closest?.(BELL_SELECTOR)) return;
      event.stopPropagation();
      event.preventDefault();
      onCloseRef.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (panelRef.current) trapTab(event, panelRef.current);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("click", onBellClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("click", onBellClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      restoreFocus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      data-testid="notification-panel"
      tabIndex={-1}
      className="fixed right-4 top-[62px] z-[1001] flex w-[420px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel"
      style={{ maxHeight: "min(680px, calc(100vh - 80px))" }}
    >
      {children}
    </div>,
    document.body,
  );
}
