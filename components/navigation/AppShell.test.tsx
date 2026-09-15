// components/navigation/AppShell.test.tsx
// Wiring test for the shell breakpoint switch (768 -> 1024, spec §1.2) and
// that the desktop sidebar/top strip and mobile tab bar/"Továbbiak" sheet
// receive the right props. Child components have their own dedicated tests,
// so they're stubbed here to keep this focused on AppShell's own wiring.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppShell } from "@/components/navigation/AppShell";

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
let mockPathname = "/dashboard";

jest.mock("expo-router", () => ({
  Slot: () => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return <Text testID="slot-content">content</Text>;
  },
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

const mockSignOut = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "u1", name: "Teszt Elek", role: "entrepreneur" } },
  }),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 2,
    latestUnread: null,
    loading: false,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    sync: jest.fn(),
  }),
}));

jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: { name: "TestCorp Kft.", taxNumber: "12345678-1-42" } }),
}));

jest.mock("@/components/notifications/NotificationBanner", () => ({
  NotificationBanner: () => null,
}));
jest.mock("@/components/notifications/NotificationPanel", () => ({
  NotificationPanel: () => null,
}));

jest.mock("@/components/navigation/AppSidebar", () => ({
  AppSidebar: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="app-sidebar" onPress={props.onNewInvoice}>
        <Text testID="sidebar-active">{props.activePathname}</Text>
        <Text testID="sidebar-role">{props.role}</Text>
        <Text testID="sidebar-collapsed">{String(props.collapsed)}</Text>
        <Pressable testID="sidebar-sign-out" onPress={props.onSignOut}>
          <Text>signOut</Text>
        </Pressable>
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/AppTopStrip", () => ({
  AppTopStrip: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="app-topstrip">
        <Text testID="topstrip-breadcrumb">
          {props.breadcrumb ? props.breadcrumb.map((i: any) => i.label).join(" / ") : ""}
        </Text>
        <Text testID="topstrip-page-title">{props.pageTitleLabelKey ?? ""}</Text>
        <Text testID="topstrip-collapsed">{String(props.collapsed)}</Text>
        <Pressable testID="topstrip-toggle-collapsed" onPress={props.onToggleCollapsed}>
          <Text>toggle</Text>
        </Pressable>
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/MobileAppHeader", () => ({
  MobileAppHeader: () => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return <Text testID="mobile-app-header">header</Text>;
  },
}));

jest.mock("@/components/navigation/MobileTabBar", () => ({
  MobileTabBar: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="mobile-tab-bar" onPress={props.onOpenMore}>
        <Text>{props.pathname}</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/MoreSheet", () => ({
  MoreSheet: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    if (!props.open) return null;
    return (
      <Pressable testID="more-sheet-sign-out" onPress={props.onSignOut}>
        <Text>open</Text>
      </Pressable>
    );
  },
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    mockSignOut.mockClear();
  });

  it("renders the desktop sidebar + top strip at 1440px, not the mobile header/tab bar", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    expect(tree.root.findAllByProps({ testID: "app-sidebar" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "app-topstrip" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "mobile-app-header" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "mobile-tab-bar" }).length).toBe(0);
    act(() => tree.unmount());
  });

  it("renders the mobile header + tab bar at 900px (tablet) — breakpoint moved from 768 to 1024", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={900} />);
    });
    expect(tree.root.findAllByProps({ testID: "mobile-app-header" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "mobile-tab-bar" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "app-sidebar" }).length).toBe(0);
    act(() => tree.unmount());
  });

  it("renders the desktop shell exactly at the 1024px breakpoint", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1024} />);
    });
    expect(tree.root.findAllByProps({ testID: "app-sidebar" }).length).toBeGreaterThan(0);
    act(() => tree.unmount());
  });

  it("passes the active pathname and role down to the sidebar", async () => {
    mockPathname = "/invoices";
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("/invoices");
    expect(json).toContain("entrepreneur");
    act(() => tree.unmount());
  });

  it("navigates to /invoices/new when the sidebar's new-invoice affordance fires", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    const sidebar = tree.root.findByProps({ testID: "app-sidebar" });
    act(() => sidebar.props.onPress());
    expect(mockRouterPush).toHaveBeenCalledWith("/invoices/new");
    act(() => tree.unmount());
  });

  it("signs out and redirects to /login from the sidebar's sign-out row", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    const signOutRow = tree.root.findByProps({ testID: "sidebar-sign-out" });
    await act(async () => {
      signOutRow.props.onPress();
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
    act(() => tree.unmount());
  });

  it("builds a Beállítások breadcrumb for a settings sub-page, not for the hub itself", async () => {
    mockPathname = "/settings/pdf";
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain("nav.settings / settings.pdf");
    act(() => tree.unmount());

    mockPathname = "/settings";
    let hubTree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      hubTree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    const hubJson = JSON.stringify(hubTree.toJSON());
    expect(hubJson).not.toContain("nav.settings / ");
    act(() => hubTree.unmount());
  });

  it("shows a page title on a top-level screen and toggles collapse from the top strip", async () => {
    mockPathname = "/invoices";
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={1440} />);
    });
    expect(tree.root.findByProps({ testID: "topstrip-page-title" }).props.children).toBe(
      "nav.invoices",
    );
    const collapsedBefore = tree.root.findByProps({ testID: "sidebar-collapsed" }).props.children;
    const toggle = tree.root.findByProps({ testID: "topstrip-toggle-collapsed" });
    act(() => toggle.props.onPress());
    const collapsedAfter = tree.root.findByProps({ testID: "sidebar-collapsed" }).props.children;
    expect(collapsedAfter).not.toBe(collapsedBefore);
    expect(tree.root.findByProps({ testID: "topstrip-collapsed" }).props.children).toBe(
      collapsedAfter,
    );
    act(() => tree.unmount());
  });

  it("opens the Továbbiak sheet from the mobile tab bar and signs out from it", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppShell viewportWidthForTest={480} />);
    });
    expect(tree.root.findAllByProps({ testID: "more-sheet-sign-out" }).length).toBe(0);
    const tabBar = tree.root.findByProps({ testID: "mobile-tab-bar" });
    act(() => tabBar.props.onPress());
    const moreSignOut = tree.root.findByProps({ testID: "more-sheet-sign-out" });
    await act(async () => {
      moreSignOut.props.onPress();
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
    act(() => tree.unmount());
  });
});
