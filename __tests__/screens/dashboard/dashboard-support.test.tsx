// __tests__/screens/dashboard/dashboard-support.test.tsx
// (Colocating this under app/(app)/dashboard/ would make Expo Router treat
// it as a conflicting route, so it lives under __tests__/ instead, same as
// the other app-screen tests in __tests__/screens/.)
// Covers the dashboard's "Ügyfélszolgálat" overflow item: wired when a
// support address is configured (mobile + desktop), absent — trigger and
// all — when it isn't, and safe when Linking.openURL rejects.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Linking } from "react-native";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: "hu" },
  }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));

const mockUseIsDesktop = jest.fn(() => true);
jest.mock("@/lib/useIsDesktop", () => ({
  useIsDesktop: () => mockUseIsDesktop(),
}));

jest.mock("@/hooks/useDashboardSummary", () => ({
  useDashboardSummary: () => ({
    summary: {
      revenue: 0,
      outstanding: 0,
      overdueTotal: 0,
      issuedTotal: 0,
      estimatedVat: 0,
      overdueCount: 0,
      oldestOverdueDays: 0,
      recentInvoices: [],
    },
    draftCount: 0,
    outstandingCount: 0,
    paidCount: 0,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/components/dashboard/NextActionsCard", () => ({ NextActionsCard: () => null }));
jest.mock("@/components/dashboard/M2mDemoCard", () => ({ M2mDemoCard: () => null }));
jest.mock("@/components/invoices/InvoiceListTable", () => ({ InvoiceListTable: () => null }));

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ header, children }: { header?: React.ReactNode; children?: React.ReactNode }) => (
    <>
      {header ?? null}
      {children ?? null}
    </>
  ),
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/heading", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Button,
  ButtonText: mockUi.ButtonText,
}));

function loadDashboardScreen() {
  // Required lazily (not a top-level `import`, which Babel hoists above the
  // jest.mock setup above and would trip a TDZ error).
  return require("@/app/(app)/dashboard/index").default;
}

async function renderScreen() {
  const DashboardScreen = loadDashboardScreen();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<DashboardScreen />);
  });
  return tree;
}

async function openOverflowMenu(tree: TestRenderer.ReactTestRenderer) {
  const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
  await act(async () => {
    trigger.props.onPress({});
  });
}

describe("Dashboard — customer service support flow", () => {
  const originalEnv = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    } else {
      process.env.EXPO_PUBLIC_SUPPORT_EMAIL = originalEnv;
    }
    jest.restoreAllMocks();
  });

  describe("configured (EXPO_PUBLIC_SUPPORT_EMAIL set)", () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPPORT_EMAIL = "help@example.test";
      mockUseIsDesktop.mockReturnValue(true);
    });

    it("renders exactly one dashboard.customerService overflow item and opens a mailto on press (AC4)", async () => {
      const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      const tree = await renderScreen();
      await openOverflowMenu(tree);

      const content = tree.root.findByProps({ testID: "overflow-menu-content" });
      // The mocked Pressable wraps react-native's own Pressable, so a single
      // logical menu item shows up as more than one composite/host instance
      // with the same testID — assert on distinct item *indices* instead.
      expect(content.findAll((node) => node.props.testID === "overflow-menu-item-1").length).toBe(0);
      const item0Instances = content.findAll((node) => node.props.testID === "overflow-menu-item-0");
      expect(item0Instances.length).toBeGreaterThan(0);
      const item = item0Instances[0];
      const labelTexts = content.findAllByType(require("react-native").Text).map((n: any) => n.props.children);
      expect(labelTexts).toContain("dashboard.customerService");

      await act(async () => {
        item.props.onPress({});
      });

      expect(openURLSpy).toHaveBeenCalledTimes(1);
      const [url] = openURLSpy.mock.calls[0];
      expect(url.startsWith("mailto:help@example.test")).toBe(true);
      expect(url).toContain(encodeURIComponent("dashboard.support.subject"));

      act(() => tree.unmount());
    });

    it("is reachable on mobile too, without promoting the incoming-invoices button (AC6)", async () => {
      mockUseIsDesktop.mockReturnValue(false);
      const tree = await renderScreen();

      expect(tree.root.findByProps({ testID: "overflow-menu-trigger" })).toBeTruthy();
      expect(() => tree.root.findByProps({ testID: "dashboard-incoming-invoices" })).toThrow();

      act(() => tree.unmount());
    });

    // The mislabelled "Bejövő számlák" (incoming-invoices) button — it
    // actually opened the *outgoing* unpaid list — was removed by
    // slice/incoming-invoices-dashboard-button, not relabelled. This test
    // used to pin its presence at desktop width; it now pins its absence,
    // at both widths (see the mobile-width test above), so a future
    // regression that reintroduces it here is caught.
    it("does not show the incoming-invoices button at desktop width either (AC6, removed)", async () => {
      mockUseIsDesktop.mockReturnValue(true);
      const tree = await renderScreen();

      expect(() => tree.root.findByProps({ testID: "dashboard-incoming-invoices" })).toThrow();

      act(() => tree.unmount());
    });

    it("does not throw and shows an inline error when Linking.openURL rejects (AC7)", async () => {
      jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
      const tree = await renderScreen();
      await openOverflowMenu(tree);

      const content = tree.root.findByProps({ testID: "overflow-menu-content" });
      const items = content.findAll((node) => node.props.testID === "overflow-menu-item-0");

      try {
        await expect(
          act(async () => {
            items[0].props.onPress({});
          })
        ).resolves.not.toThrow();

        // The resulting setState is scheduled at default (non-urgent)
        // priority, since it originates from a promise continuation rather
        // than a synchronous event handler — one more empty async act()
        // pass lets React's scheduler flush it.
        await act(async () => {});

        const json = JSON.stringify(tree.toJSON());
        expect(json).toContain("dashboard.support.openFailed");
      } finally {
        act(() => tree.unmount());
      }
    });
  });

  describe("unconfigured (EXPO_PUBLIC_SUPPORT_EMAIL unset) — AC5", () => {
    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    });

    it("renders no customerService item and no overflow trigger at desktop width", async () => {
      mockUseIsDesktop.mockReturnValue(true);
      const tree = await renderScreen();

      expect(() => tree.root.findByProps({ testID: "overflow-menu-trigger" })).toThrow();
      const json = JSON.stringify(tree.toJSON());
      expect(json).not.toContain("dashboard.customerService");

      act(() => tree.unmount());
    });

    it("renders no customerService item and no overflow trigger at mobile width", async () => {
      mockUseIsDesktop.mockReturnValue(false);
      const tree = await renderScreen();

      expect(() => tree.root.findByProps({ testID: "overflow-menu-trigger" })).toThrow();
      const json = JSON.stringify(tree.toJSON());
      expect(json).not.toContain("dashboard.customerService");

      act(() => tree.unmount());
    });
  });

  describe("PageHeader overflow label (AC9)", () => {
    it("passes t('nav.more') as the overflow trigger's accessible label", async () => {
      process.env.EXPO_PUBLIC_SUPPORT_EMAIL = "help@example.test";
      mockUseIsDesktop.mockReturnValue(true);
      const tree = await renderScreen();

      const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
      expect(trigger.props.accessibilityLabel).toBe("nav.more");

      act(() => tree.unmount());
    });
  });
});
