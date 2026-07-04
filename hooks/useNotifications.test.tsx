// hooks/useNotifications.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useNotifications } from "@/hooks/useNotifications";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const sampleNotification = {
  id: "n1",
  userId: "u1",
  type: "system" as const,
  title: "Test",
  body: "Body",
  read: false,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
};

async function renderUseNotifications(syncOnMount = true) {
  const ref: { current: ReturnType<typeof useNotifications> | null } = { current: null };

  function HookHost() {
    ref.current = useNotifications({ syncOnMount });
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

describe("useNotifications", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      notifications: [sampleNotification],
      unreadCount: 1,
    });
  });

  it("loads notifications with sync on mount by default", async () => {
    const ref = await renderUseNotifications();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications?sync=1");
    expect(ref.current?.notifications).toHaveLength(1);
    expect(ref.current?.unreadCount).toBe(1);
    expect(ref.current?.latestUnread?.id).toBe("n1");
  });

  it("marks a notification read locally", async () => {
    const ref = await renderUseNotifications();
    await act(async () => {
      await Promise.resolve();
    });

    mockApiFetch.mockResolvedValueOnce(undefined);

    await act(async () => {
      await ref.current?.markRead("n1");
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications/n1", {
      method: "PATCH",
    });
    expect(ref.current?.unreadCount).toBe(0);
    expect(ref.current?.notifications[0].read).toBe(true);
  });

  it("marks all notifications read", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        notifications: [sampleNotification],
        unreadCount: 1,
      })
      .mockResolvedValueOnce(undefined);

    const ref = await renderUseNotifications();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await ref.current?.markAllRead();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications/read-all", {
      method: "POST",
    });
    expect(ref.current?.unreadCount).toBe(0);
  });
});
