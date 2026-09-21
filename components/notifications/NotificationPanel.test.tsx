// components/notifications/NotificationPanel.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ScrollView } from "react-native";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
import type { AppNotification } from "@/lib/notifications/types";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

jest.mock("@/components/ui/drawer", () => {
  const { View } = require("react-native");
  return {
    Drawer: ({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) =>
      isOpen ? <View testID="drawer-open">{children}</View> : null,
    DrawerBackdrop: View,
    DrawerContent: View,
    DrawerHeader: View,
    DrawerBody: View,
    DrawerCloseButton: View,
  };
});

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    primary: "#6495ed",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#8db600",
    accentForeground: "#1f305e",
    secondary: "#111f4a",
  }),
}));

// Real hu-locale lookup (not identity) so assertions prove Hungarian text,
// not just "whatever key was passed".
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const parts = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = require("@/lib/i18n/locales/hu").default;
      for (const part of parts) value = value?.[part];
      if (typeof value !== "string") return key;
      return value.replace(/\{\{(\w+)\}\}/g, (_m: string, name: string) =>
        String(opts?.[name] ?? "")
      );
    },
  }),
}));

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    userId: "u1",
    type: "overdue_invoice",
    title: "Lejárt: INV-001",
    read: false,
    createdAt: "2026-07-05T07:00:00.000Z", // 5h before frozen now
    updatedAt: "2026-07-05T07:00:00.000Z",
    ...overrides,
  };
}

const baseProps = {
  open: true,
  onClose: jest.fn(),
  notifications: [] as AppNotification[],
  unreadCount: 0,
  loading: false,
  onMarkRead: jest.fn(),
  onMarkAllRead: jest.fn(),
  onSync: jest.fn(),
};

function render(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides };
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotificationPanel {...props} />);
  });
  return { tree: tree!, props };
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-05T12:00:00.000Z"));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders no hardcoded English chrome literals (AC1)", () => {
    const { tree } = render({
      notifications: [makeNotification()],
      unreadCount: 1,
    });
    const json = JSON.stringify(tree.toJSON());
    for (const banned of [
      "Notifications",
      "Mark all read",
      "Refresh",
      "No notifications yet",
      "Just now",
      " ago",
      "Close",
    ]) {
      expect(json).not.toContain(banned);
    }
  });

  it("renders the Hungarian title and unread badge with a11y label (AC2)", () => {
    const { tree } = render({ unreadCount: 3 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Értesítések");
    const badge = tree.root.findAll(
      (node) => node.props?.accessibilityLabel === "3 olvasatlan"
    );
    expect(badge.length).toBeGreaterThan(0);
  });

  it("does not render the unread badge when unreadCount is 0", () => {
    const { tree } = render({ unreadCount: 0 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("olvasatlan");
  });

  it("renders mark-all-read only when unreadCount > 0, with a11y label, and calls onMarkAllRead once (AC3)", () => {
    const zero = render({ unreadCount: 0 });
    expect(JSON.stringify(zero.tree.toJSON())).not.toContain("Mind olvasott");

    const { tree, props } = render({ unreadCount: 2 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Mind olvasott");

    const button = tree.root.findAll(
      (node) =>
        node.props?.accessibilityLabel === "Összes értesítés megjelölése olvasottként"
    )[0];
    expect(button).toBeTruthy();
    act(() => {
      button.props.onPress();
    });
    expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("renders the refresh button and calls onSync once (AC4)", () => {
    const { tree, props } = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Frissítés");

    const buttons = tree.root.findAll((node) => typeof node.props?.onPress === "function");
    const refreshButton = buttons.find(
      (node) => node.findAll((child) => child.props?.children === "Frissítés").length > 0
    );
    expect(refreshButton).toBeTruthy();
    act(() => {
      refreshButton!.props.onPress();
    });
    expect(props.onSync).toHaveBeenCalledTimes(1);
  });

  it("action buttons carry TAP_TARGET_MIN_H and rows are at least min-h-11 (AC5)", () => {
    const { tree } = render({
      unreadCount: 1,
      notifications: [makeNotification()],
    });
    const classNames = tree.root
      .findAll((node) => typeof node.props?.className === "string")
      .map((node) => node.props.className as string);
    const withFloor = classNames.filter((c) => c.includes(TAP_TARGET_MIN_H));
    // At least the two action buttons + one row pressable/box.
    expect(withFloor.length).toBeGreaterThanOrEqual(2);
    const rowClass = classNames.find((c) => c.includes("min-h-11") && c.includes("border-b"));
    expect(rowClass).toBeTruthy();
  });

  it("renders a visible close control that calls onClose (AC6)", () => {
    const { tree, props } = render();
    const closeButton = tree.root.findAll(
      (node) =>
        node.props?.accessibilityRole === "button" &&
        node.props?.accessibilityLabel === "Értesítések bezárása"
    )[0];
    expect(closeButton).toBeTruthy();
    act(() => {
      closeButton.props.onPress();
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state naming the three real sources (AC7)", () => {
    const { tree } = render({ notifications: [], loading: false });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Nincs még értesítés");
    expect(json).toContain("lejárt számlák");
    expect(json).toContain("fizetésre váró számlák");
    expect(json).toContain("NAV-beküldések");
  });

  it("loading state's ActivityIndicator has an accessibilityLabel (AC8)", () => {
    const { tree } = render({ loading: true });
    const indicator = tree.root.findAll(
      (node) => node.props?.accessibilityLabel === "Értesítések betöltése"
    );
    expect(indicator.length).toBeGreaterThan(0);
  });

  it("renders relative timestamps via i18n keys (AC11)", () => {
    const { tree } = render({
      notifications: [
        makeNotification({ id: "n-hours", createdAt: "2026-07-05T07:00:00.000Z" }), // 5h ago
        makeNotification({ id: "n-justnow", createdAt: "2026-07-05T11:59:40.000Z" }), // 20s ago
      ],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("5 órája");
    expect(json).toContain("Az imént");
  });

  it("does not wrap the list in a second ScrollView (AC13)", () => {
    const { tree } = render({ notifications: [makeNotification()] });
    const scrollViews = tree.root.findAllByType(ScrollView);
    expect(scrollViews.length).toBe(0);
  });

  it("renders a legacy pre-fix English row's title translated to Hungarian, with no DB write (AC8)", () => {
    const { tree } = render({
      notifications: [
        makeNotification({
          id: "n-legacy",
          title: "Overdue: 2026/007",
          referenceKey: "overdue:inv-1",
        }),
      ],
      unreadCount: 1,
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Lejárt: 2026/007");
    expect(json).not.toContain("Overdue: 2026/007");
  });

  it("renders an unrecognised title verbatim (AC8)", () => {
    const { tree } = render({
      notifications: [
        makeNotification({
          id: "n-custom",
          title: "A completely custom note",
        }),
      ],
      unreadCount: 1,
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("A completely custom note");
  });
});
