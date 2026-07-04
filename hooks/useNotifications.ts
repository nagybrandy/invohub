// hooks/useNotifications.ts
// In-app notifications with sync, unread count, and read actions.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { AppNotification } from "@/lib/notifications/types";

type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

export function useNotifications(options?: { syncOnMount?: boolean }) {
  const syncOnMount = options?.syncOnMount ?? true;
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async (sync = false) => {
    setLoading(true);
    try {
      const path = sync ? "/api/notifications?sync=1" : "/api/notifications";
      const data = await apiFetch<NotificationsResponse>(path);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh(syncOnMount);
  }, [refresh, syncOnMount]);

  const markRead = React.useCallback(
    async (id: string) => {
      await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    []
  );

  const markAllRead = React.useCallback(async () => {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const sync = React.useCallback(async () => {
    await refresh(true);
  }, [refresh]);

  const latestUnread = React.useMemo(
    () => notifications.find((n) => !n.read) ?? null,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    latestUnread,
    loading,
    refresh,
    sync,
    markRead,
    markAllRead,
  };
}
