// components/navigation/MobileTabBar.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

describe("MobileTabBar", () => {
  it("renders exactly 5 tabs in order: Számlák, Partnerek, +, Vezérlőpult, Továbbiak", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MobileTabBar pathname="/dashboard" onNavigate={jest.fn()} onOpenMore={jest.fn()} />,
      );
    });
    const order = ["nav.invoices", "nav.partners", "nav.newInvoice", "nav.dashboard", "nav.more"];
    const json = JSON.stringify(tree.toJSON());
    let lastIndex = -1;
    for (const key of order) {
      const idx = json.indexOf(`"${key}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    act(() => tree.unmount());
  });

  it("styles the centre + as a raised FAB", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MobileTabBar pathname="/dashboard" onNavigate={jest.fn()} onOpenMore={jest.fn()} />,
      );
    });
    const fab = tree.root.find((node) => node.props?.accessibilityLabel === "nav.newInvoice");
    expect(fab.props.className).toContain("h-[52px]");
    expect(fab.props.className).toContain("w-[52px]");
    expect(fab.props.className).toContain("-mt-5");
    act(() => tree.unmount());
  });

  it("navigates when a route tab is pressed", async () => {
    const onNavigate = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MobileTabBar pathname="/dashboard" onNavigate={onNavigate} onOpenMore={jest.fn()} />,
      );
    });
    const partnersTab = tree.root.find((node) => node.props?.accessibilityLabel === "nav.partners");
    act(() => partnersTab.props.onPress?.());
    expect(onNavigate).toHaveBeenCalledWith("/clients");
    act(() => tree.unmount());
  });

  it("opens the Továbbiak sheet instead of navigating for the last tab", async () => {
    const onOpenMore = jest.fn();
    const onNavigate = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MobileTabBar pathname="/dashboard" onNavigate={onNavigate} onOpenMore={onOpenMore} />,
      );
    });
    const moreTab = tree.root.find((node) => node.props?.accessibilityLabel === "nav.more");
    act(() => moreTab.props.onPress?.());
    expect(onOpenMore).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it("marks the active tab", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MobileTabBar pathname="/clients" onNavigate={jest.fn()} onOpenMore={jest.fn()} />,
      );
    });
    const partnersTab = tree.root.find((node) => node.props?.accessibilityLabel === "nav.partners");
    expect(partnersTab.props.accessibilityState?.selected).toBe(true);
    act(() => tree.unmount());
  });
});
