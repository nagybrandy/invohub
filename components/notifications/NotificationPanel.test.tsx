// components/notifications/NotificationPanel.test.tsx
// Native notification panel (SPEC §7.3): a bottom sheet with the redesigned
// content. The shared content is exercised here; the web popover has its own
// DOM test (NotificationPanel.web.test.tsx).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import type { AppNotification } from "@/lib/notifications/types";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    primary: "#6495ed",
    muted: "#64748b",
    faint: "#8a8d92",
    foreground: "#0f172a",
    destructive: "#dc2626",
    warn: "#8a5200",
    ok: "#1b7a4f",
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
      return value.replace(/\{\{(\w+)\}\}/g, (_m: string, name: string) => String(opts?.[name] ?? ""));
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
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotificationPanel {...props} />);
  });
  return { tree, props };
}

function text(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

const hosts = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props.testID === testID && typeof n.type === "string");

function pressOf(host: TestRenderer.ReactTestInstance) {
  let node: TestRenderer.ReactTestInstance | null = host;
  while (node && typeof node.props.onPress !== "function") node = node.parent;
  if (!node) throw new Error("nothing pressable");
  return node;
}

const nav = makeNotification({
  id: "nav",
  type: "nav_pending",
  title: "NAV-beküldés folyamatban",
  body: "INV-1 a NAV visszaigazolására vár.",
  href: "/invoices/1",
  read: false,
  createdAt: "2026-07-05T09:00:00.000Z",
});
const overdue = makeNotification({
  id: "ov",
  type: "overdue_invoice",
  href: "/invoices/2",
  read: true,
  createdAt: "2026-07-05T07:00:00.000Z",
});
const sent = makeNotification({
  id: "se",
  type: "invoice_sent",
  title: "Fizetésre vár: INV-3",
  read: false,
  createdAt: "2026-07-04T07:00:00.000Z",
});
const system = makeNotification({
  id: "sy",
  type: "system",
  title: "Üdvözlünk az InvoHubban",
  read: true,
  createdAt: "2026-06-01T07:00:00.000Z",
});
const all = [nav, overdue, sent, system];

describe("NotificationPanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-05T12:00:00.000Z"));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when closed", () => {
    const { tree } = render({ open: false, notifications: all, unreadCount: 2 });
    expect(tree.toJSON()).toBeNull();
  });

  it("renders no hardcoded English chrome literals", () => {
    const { tree } = render({ notifications: [makeNotification()], unreadCount: 1 });
    const json = text(tree);
    for (const banned of ["Notifications", "Mark all read", "Refresh", "No notifications yet", "Just now", " ago", "Close"]) {
      expect(json).not.toContain(banned);
    }
  });

  it("renders the Hungarian title, the filter tabs and the unread count in the second tab", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    const json = text(tree);
    expect(json).toContain("Értesítések");
    expect(json).toContain("Összes");
    expect(json).toContain("Olvasatlan (2)");
  });

  it("groups to-dos (overdue, NAV) under Teendők and the rest under Korábbi", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    const todos = collect(hosts(tree, "notification-group-todos")[0]);
    const earlier = collect(hosts(tree, "notification-group-earlier")[0]);
    expect(todos).toContain("Teendők");
    expect(todos).toContain("NAV-beküldés folyamatban");
    expect(todos).toContain("Lejárt: INV-001");
    expect(todos).not.toContain("Fizetésre vár: INV-3");
    expect(earlier).toContain("Korábbi");
    expect(earlier).toContain("Fizetésre vár: INV-3");
    expect(earlier).toContain("Üdvözlünk az InvoHubban");
  });

  it("the Olvasatlan tab lists unread items only", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    const radio = tree.root.findAll(
      (n) => n.props.testID === "notification-tab-unread" && typeof n.type === "string",
    )[0];
    act(() => {
      pressOf(radio).props.onPress();
    });
    const list = collect(hosts(tree, "notification-list")[0]);
    expect(list).toContain("NAV-beküldés folyamatban");
    expect(list).toContain("Fizetésre vár: INV-3");
    expect(list).not.toContain("Lejárt: INV-001");
    expect(list).not.toContain("Üdvözlünk az InvoHubban");
  });

  it("'Mind olvasott' calls onMarkAllRead once, and is disabled with nothing unread", () => {
    const { tree, props } = render({ notifications: all, unreadCount: 2 });
    const button = pressOf(hosts(tree, "notification-mark-all-read")[0]);
    expect(button.props.isDisabled).toBe(false);
    expect(button.props.accessibilityLabel).toBe("Összes értesítés megjelölése olvasottként");
    act(() => {
      button.props.onPress();
    });
    expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);

    const zero = render({ notifications: [overdue, system], unreadCount: 0 });
    expect(pressOf(hosts(zero.tree, "notification-mark-all-read")[0]).props.isDisabled).toBe(true);
  });

  it("marks an unread item read, closes and navigates when it is pressed", () => {
    const { tree, props } = render({ notifications: all, unreadCount: 2 });
    const main = hosts(tree, "notification-item-main")[0]; // newest first: the NAV one
    act(() => {
      pressOf(main).props.onPress();
    });
    expect(props.onMarkRead).toHaveBeenCalledWith("nav");
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/invoices/1");
  });

  it("does not mark an already read item read again", () => {
    const { tree, props } = render({ notifications: [overdue], unreadCount: 0 });
    act(() => {
      pressOf(hosts(tree, "notification-item-main")[0]).props.onPress();
    });
    expect(props.onMarkRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/invoices/2");
  });

  it("offers one 'Megnyitás' action only on items with an href, and it navigates", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    // nav and overdue have an href; sent and system do not.
    const openButtons = hosts(tree, "notification-item-open");
    expect(openButtons).toHaveLength(2);
    expect(text(tree)).toContain("Megnyitás");
    act(() => {
      pressOf(openButtons[1]).props.onPress();
    });
    expect(mockPush).toHaveBeenCalled();
  });

  it("has no send / resubmit / reminder actions (SPEC §11)", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    const json = text(tree);
    expect(json).not.toMatch(/Újraküldés|Emlékeztető küldése|resubmit|remind/i);
  });

  it("draws an unread dot only on unread items, red for to-dos and blue for the rest", () => {
    const { tree } = render({ notifications: all, unreadCount: 2 });
    const dots = hosts(tree, "notification-unread-dot");
    expect(dots).toHaveLength(2);
    expect(String(dots[0].props.className)).toContain("bg-err"); // nav_pending
    expect(String(dots[1].props.className)).toContain("bg-primary"); // invoice_sent
  });

  it("shows 'Minden elintézve' when there is nothing", () => {
    const { tree } = render({ notifications: [], loading: false });
    expect(hosts(tree, "notification-empty")).toHaveLength(1);
    expect(text(tree)).toContain("Minden elintézve");
  });

  it("shows a loading indicator with an accessible label while loading", () => {
    const { tree } = render({ loading: true });
    const indicator = tree.root.findAll((node) => node.props?.accessibilityLabel === "Értesítések betöltése");
    expect(indicator.length).toBeGreaterThan(0);
  });

  it("renders relative timestamps via i18n keys", () => {
    const { tree } = render({
      notifications: [
        makeNotification({ id: "n-hours", createdAt: "2026-07-05T07:00:00.000Z" }), // 5h ago
        makeNotification({ id: "n-justnow", createdAt: "2026-07-05T11:59:40.000Z" }), // 20s ago
      ],
    });
    const json = text(tree);
    expect(json).toContain("5 órája");
    expect(json).toContain("Az imént");
  });

  it("renders a legacy pre-fix English row's title translated to Hungarian, with no DB write", () => {
    const { tree } = render({
      notifications: [makeNotification({ id: "n-legacy", title: "Overdue: 2026/007", referenceKey: "overdue:inv-1" })],
      unreadCount: 1,
    });
    const json = text(tree);
    expect(json).toContain("Lejárt: 2026/007");
    expect(json).not.toContain("Overdue: 2026/007");
  });

  it("renders an unrecognised title verbatim", () => {
    const { tree } = render({
      notifications: [makeNotification({ id: "n-custom", title: "A completely custom note" })],
      unreadCount: 1,
    });
    expect(text(tree)).toContain("A completely custom note");
  });
});

function collect(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return node.children.map(collect).join(" ");
}
