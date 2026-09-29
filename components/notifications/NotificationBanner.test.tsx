// components/notifications/NotificationBanner.test.tsx
import { Platform } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import hu from "@/lib/i18n/locales/hu";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    isDarkColorScheme: false,
    toggleTheme: jest.fn(),
  }),
}));
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
// Real hu-locale lookup (not identity) so the banner text test actually
// proves Hungarian, not just "whatever key was passed" (N7).
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const parts = key.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = require("@/lib/i18n/locales/hu").default;
      for (const part of parts) value = value?.[part];
      if (typeof value !== "string") return key;
      return value.replace(/\{\{(\w+)\}\}/g, (_m: string, name: string) =>
        String(opts?.[name] ?? ""),
      );
    },
  }),
}));

const notification = {
  id: "n1",
  userId: "u1",
  type: "overdue_invoice" as const,
  title: "Lejárt: INV-001",
  read: false,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
};

function makeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe("NotificationBanner", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = "web";
    (globalThis as any).sessionStorage = makeSessionStorage();
    (globalThis.window as any).sessionStorage = (globalThis as any).sessionStorage;
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    delete (globalThis as any).sessionStorage;
    delete (globalThis.window as any).sessionStorage;
  });

  it("renders title and extra count in Hungarian", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={3} onPress={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Lejárt: INV-001");
    expect(json).toContain(hu.notifications.banner.more.replace("{{count}}", "2"));
  });

  it("is exactly 40px tall", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={1} onPress={jest.fn()} />
      );
    });
    const banner = tree!.root.find((node) => node.props?.testID === "notification-banner");
    expect(banner.props.className).toContain("h-10");
  });

  it("calls onPress when the body is tapped", () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={1} onPress={onPress} />
      );
    });
    const pressable = tree!.root.find(
      (node) => typeof node.props?.onPress === "function" && node.props.accessibilityLabel === undefined
    );
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalled();
  });

  it("dismisses on X press and stays dismissed across remounts (sessionStorage)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={1} onPress={jest.fn()} />
      );
    });
    const dismissButton = tree!.root.find(
      (node) => node.props?.accessibilityLabel === hu.notifications.banner.dismiss
    );
    act(() => {
      dismissButton.props.onPress();
    });
    expect(tree!.toJSON()).toBeNull();
    act(() => tree!.unmount());

    let remounted: TestRenderer.ReactTestRenderer;
    act(() => {
      remounted = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={1} onPress={jest.fn()} />
      );
    });
    expect(remounted!.toJSON()).toBeNull();
    act(() => remounted!.unmount());
  });

  it("shows a different, new notification even after the previous one was dismissed", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={notification} unreadCount={1} onPress={jest.fn()} />
      );
    });
    const dismissButton = tree!.root.find(
      (node) => node.props?.accessibilityLabel === hu.notifications.banner.dismiss
    );
    act(() => dismissButton.props.onPress());
    act(() => tree!.unmount());

    const nextNotification = { ...notification, id: "n2", title: "Lejárt: INV-002" };
    let nextTree: TestRenderer.ReactTestRenderer;
    act(() => {
      nextTree = TestRenderer.create(
        <NotificationBanner notification={nextNotification} unreadCount={1} onPress={jest.fn()} />
      );
    });
    expect(JSON.stringify(nextTree!.toJSON())).toContain("Lejárt: INV-002");
    act(() => nextTree!.unmount());
  });

  it("renders a legacy pre-fix English title translated to Hungarian; the +N suffix still appends (AC9)", () => {
    const legacyNotification = {
      ...notification,
      id: "n-legacy",
      title: "Overdue: 2026/007",
      referenceKey: "overdue:inv-1",
    };
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner notification={legacyNotification} unreadCount={3} onPress={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Lejárt: 2026/007");
    expect(json).not.toContain("Overdue: 2026/007");
    expect(json).toContain(hu.notifications.banner.more.replace("{{count}}", "2"));
  });
});
