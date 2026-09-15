// components/navigation/AppTopStrip.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppTopStrip } from "@/components/navigation/AppTopStrip";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    primary: "#6495ed",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#8db600",
    accentForeground: "#1f305e",
    secondary: "#1f305e",
  }),
}));
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => {
    const { Text } = require("react-native");
    return <Text testID="topstrip-language-switcher">LANG</Text>;
  },
}));
// Breadcrumb pulls in expo-router's `router` singleton, which drags a
// transitive dep (`standard-navigation`) jest.config.js doesn't transform —
// unrelated to this component, so it's stubbed the same way other cross-cutting
// deps (LanguageSwitcher, icon colors) are stubbed above.
jest.mock("@/components/layout/Breadcrumb", () => ({
  Breadcrumb: ({ items }: { items: { label: string }[] }) => {
    const { Text } = require("react-native");
    return <Text testID="topstrip-breadcrumb-stub">{items.map((i) => i.label).join(" / ")}</Text>;
  },
}));

const baseProps = {
  unreadCount: 0,
  onOpenNotifications: jest.fn(),
  userName: "Teszt Elek",
  onOpenAccount: jest.fn(),
  onOpenCompany: jest.fn(),
  onSignOut: jest.fn(),
  collapsed: false,
  onToggleCollapsed: jest.fn(),
};

describe("AppTopStrip", () => {
  it("shows no breadcrumb on a top-level screen without a page title", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppTopStrip {...baseProps} breadcrumb={undefined} />);
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain("topstrip-breadcrumb-stub");
    act(() => tree.unmount());
  });

  it("shows the page title in place of the breadcrumb on a top-level screen", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppTopStrip {...baseProps} breadcrumb={undefined} pageTitleLabelKey="nav.invoices" />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain("nav.invoices");
    act(() => tree.unmount());
  });

  it("prefers the breadcrumb over the page title when both are given", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppTopStrip
          {...baseProps}
          breadcrumb={[{ label: "Beállítások", href: "/settings" }, { label: "PDF" }]}
          pageTitleLabelKey="nav.settings"
        />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("topstrip-breadcrumb-stub");
    expect(json).not.toContain('"nav.settings"');
    act(() => tree.unmount());
  });

  it("renders a collapse-sidebar toggle and fires onToggleCollapsed", async () => {
    const onToggleCollapsed = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppTopStrip {...baseProps} collapsed={false} onToggleCollapsed={onToggleCollapsed} />,
      );
    });
    const toggle = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.collapseSidebar",
    );
    act(() => toggle.props.onPress?.());
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("labels the toggle as expand when the sidebar is collapsed", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppTopStrip {...baseProps} collapsed />);
    });
    const toggle = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.expandSidebar",
    );
    expect(toggle).toBeTruthy();
    act(() => tree.unmount());
  });

  it("renders a breadcrumb when the screen provides one, first item leads back to the parent", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppTopStrip
          {...baseProps}
          breadcrumb={[{ label: "Beállítások", href: "/settings" }, { label: "PDF" }]}
        />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Beállítások");
    expect(json).toContain("PDF");
    act(() => tree.unmount());
  });

  it("shows the unread badge and opens notifications on bell press", async () => {
    const onOpenNotifications = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppTopStrip {...baseProps} unreadCount={4} onOpenNotifications={onOpenNotifications} />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('"4"');
    const bell = tree.root.find((node) => node.props?.accessibilityLabel === "nav.notifications");
    act(() => bell.props.onPress?.());
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("places the language switcher and user avatar on the right", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppTopStrip {...baseProps} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain("topstrip-language-switcher");
    const avatar = tree.root.find((node) => node.props?.accessibilityLabel === "nav.accountSettings");
    expect(avatar).toBeTruthy();
    act(() => tree.unmount());
  });
});
