// components/notifications/panel-types.ts
// Props of NotificationPanel, shared by the native file and its web twin.
import type { AppNotification } from "@/lib/notifications/types";

export type NotificationPanelProps = {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  /**
   * Kept for the shell's call site. The redesigned panel has no refresh button
   * (the shell syncs on mount), so it is not called.
   */
  onSync?: () => void;
};

/** The phone sheet starts under the top bar (tokens.md §6.15). */
export const PHONE_SHEET_TOP_OFFSET = 64;
