// components/navigation/AppShell.test.tsx
// Wiring test for the redesigned shell (SPEC §5): the sidebar shell from 701px,
// the phone shell (header + tab bar + sheets) up to 700px, the account menu fed
// with the real session / company / billing accounts, and the logout confirm
// that sits between "Kijelentkezés" and the actual sign-out. Child components
// have their own tests, so they are stubbed here.
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

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

for (const m of ["box", "hstack", "vstack"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

const mockSignOut = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "u1", name: "Teszt Elek", email: "elek@teszt.hu", role: "entrepreneur" } },
  }),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 2,
    latestUnread: { id: "n1" },
    loading: false,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    sync: jest.fn(),
  }),
}));

jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: { name: "TestCorp Kft.", taxNumber: "12345678-1-42" } }),
}));

const mockSwitchTo = jest.fn();
let mockWorkspaces: Record<string, unknown> = {};
jest.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: () => mockWorkspaces,
}));

jest.mock("@/lib/workspaces/pending-invite", () => ({ takePendingInvite: () => null }));

const mockNotificationBanner = jest.fn(() => null);
jest.mock("@/components/notifications/NotificationBanner", () => ({
  NotificationBanner: () => mockNotificationBanner(),
}));
jest.mock("@/components/notifications/NotificationPanel", () => ({
  NotificationPanel: (props: { open: boolean }) => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return props.open ? <Text testID="notification-panel-open">panel</Text> : null;
  },
}));

jest.mock("@/components/navigation/AccountMenu", () => ({
  AccountMenu: (props: any) => {
    const { Pressable, Text } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID={`stub-account-${props.variant}`}>
        <Text testID={`account-${props.variant}-collapsed`}>{String(props.collapsed)}</Text>
        <Text testID={`account-${props.variant}-accounts`}>{JSON.stringify(props.accounts)}</Text>
        <Text testID={`account-${props.variant}-user`}>{JSON.stringify(props.user)}</Text>
        <Text testID={`account-${props.variant}-company`}>{JSON.stringify(props.company)}</Text>
        <Pressable testID={`account-${props.variant}-switch`} onPress={() => props.onSwitch("ws-1")} />
        <Pressable testID={`account-${props.variant}-switch-own`} onPress={() => props.onSwitch(null)} />
        <Pressable testID={`account-${props.variant}-manage`} onPress={props.onManage} />
        <Pressable testID={`account-${props.variant}-company-edit`} onPress={props.onEditCompany} />
        <Pressable testID={`account-${props.variant}-sign-out`} onPress={props.onSignOut} />
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/LogoutConfirm", () => {
  const actual = jest.requireActual("@/components/navigation/LogoutConfirm");
  return {
    useLogoutConfirm: actual.useLogoutConfirm,
    LogoutConfirm: (props: { open: boolean; onCancel: () => void; onConfirm: () => void }) => {
      const { Pressable } = require("@/__tests__/mocks/gluestack-ui");
      if (!props.open) return null;
      return (
        <>
          <Pressable testID="logout-dialog-cancel" onPress={props.onCancel} />
          <Pressable testID="logout-dialog-confirm" onPress={props.onConfirm} />
        </>
      );
    },
  };
});
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

jest.mock("@/components/navigation/AppSidebar", () => ({
  AppSidebar: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="app-sidebar">
        <Text testID="sidebar-active">{props.activePathname}</Text>
        <Text testID="sidebar-role">{props.role}</Text>
        <Text testID="sidebar-collapsed">{String(props.collapsed)}</Text>
        <Pressable testID="sidebar-toggle" onPress={props.onToggleCollapsed} />
        <Pressable testID="sidebar-new-invoice" onPress={props.onNewInvoice} />
        <Pressable testID="sidebar-new-receipt" onPress={props.onNewReceipt} />
        <Pressable testID="sidebar-new-partner" onPress={props.onNewPartner} />
        <Pressable testID="sidebar-navigate" onPress={() => props.onNavigate("/invoices")} />
        {props.accountMenu}
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/AppTopStrip", () => ({
  AppTopStrip: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="app-topstrip" onPress={props.onOpenNotifications}>
        <Text testID="topstrip-unread">{String(props.unreadCount)}</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/MobileAppHeader", () => ({
  MobileAppHeader: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="mobile-app-header" onPress={props.onOpenNotifications}>
        <Text>header</Text>
        {props.accountMenu}
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/MobileTabBar", () => ({
  MobileTabBar: (props: any) => {
    const { Text, Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="mobile-tab-bar">
        <Text>{props.pathname}</Text>
        <Pressable testID="tab-open-new" onPress={props.onOpenNew} />
        <Pressable testID="tab-open-more" onPress={props.onOpenMore} />
      </Pressable>
    );
  },
}));

jest.mock("@/components/navigation/NewSheet", () => ({
  NewSheet: (props: any) => {
    const { Pressable } = require("@/__tests__/mocks/gluestack-ui");
    if (!props.open) return null;
    return (
      <>
        <Pressable testID="new-sheet-invoice" onPress={props.onNewInvoice} />
        <Pressable testID="new-sheet-receipt" onPress={props.onNewReceipt} />
      </>
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

async function mount(width: number) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(() => {
    tree = TestRenderer.create(<AppShell viewportWidthForTest={width} />);
  });
  return tree;
}
const press = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  act(() => tree.root.findAll((n) => n.props?.testID === testID && typeof n.props.onPress === "function")[0].props.onPress());
const present = (tree: TestRenderer.ReactTestRenderer, testID: string) => tree.root.findAllByProps({ testID }).length > 0;

describe("AppShell", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    mockSignOut.mockClear();
    mockSwitchTo.mockClear();
    mockNotificationBanner.mockClear();
    mockWorkspaces = {
      accounts: [
        { id: "u1", name: "Teszt Elek", kind: "person", role: "owner", isOwn: true },
        { id: "ws-1", name: "Ügyfél Kft.", kind: "workspace", role: "accountant", isOwn: false },
      ],
      active: { id: "u1", name: "Teszt Elek", kind: "person", role: "owner", isOwn: true },
      role: "owner",
      inForeignAccount: false,
      switchTo: mockSwitchTo,
    };
  });

  describe("breakpoints (SPEC §3)", () => {
    it("renders the sidebar shell at 1440px, not the phone header / tab bar", async () => {
      const tree = await mount(1440);
      expect(present(tree, "app-sidebar")).toBe(true);
      expect(present(tree, "app-topstrip")).toBe(true);
      expect(present(tree, "mobile-app-header")).toBe(false);
      expect(present(tree, "mobile-tab-bar")).toBe(false);
      act(() => tree.unmount());
    });

    it("renders the sidebar shell at 820px (tablet, the rail) and exactly at 701px", async () => {
      for (const width of [701, 820, 1099]) {
        const tree = await mount(width);
        expect(present(tree, "app-sidebar")).toBe(true);
        act(() => tree.unmount());
      }
    });

    it("renders the phone shell at 700px and 375px: no sidebar", async () => {
      for (const width of [375, 700]) {
        const tree = await mount(width);
        expect(present(tree, "mobile-app-header")).toBe(true);
        expect(present(tree, "mobile-tab-bar")).toBe(true);
        expect(present(tree, "app-sidebar")).toBe(false);
        expect(present(tree, "app-topstrip")).toBe(false);
        act(() => tree.unmount());
      }
    });

    it("starts the sidebar collapsed at 820 and expanded at 1440 (no stored choice)", async () => {
      const tablet = await mount(820);
      expect(tablet.root.findByProps({ testID: "sidebar-collapsed" }).props.children).toBe("true");
      act(() => tablet.unmount());
      const wide = await mount(1440);
      expect(wide.root.findByProps({ testID: "sidebar-collapsed" }).props.children).toBe("false");
      act(() => wide.unmount());
    });
  });

  describe("sidebar shell", () => {
    it("passes the active pathname and role down", async () => {
      mockPathname = "/invoices";
      const tree = await mount(1440);
      expect(tree.root.findByProps({ testID: "sidebar-active" }).props.children).toBe("/invoices");
      expect(tree.root.findByProps({ testID: "sidebar-role" }).props.children).toBe("entrepreneur");
      act(() => tree.unmount());
    });

    it("the split button targets: Új számla, Új nyugta, Új partner", async () => {
      const tree = await mount(1440);
      press(tree, "sidebar-new-invoice");
      press(tree, "sidebar-new-receipt");
      press(tree, "sidebar-new-partner");
      expect(mockRouterPush.mock.calls.map((c) => c[0])).toEqual(["/invoices/new", "/receipts/new", "/clients/new"]);
      act(() => tree.unmount());
    });

    it("toggles the sidebar from the sidebar head, not the top bar", async () => {
      const tree = await mount(1440);
      expect(tree.root.findByProps({ testID: "sidebar-collapsed" }).props.children).toBe("false");
      press(tree, "sidebar-toggle");
      expect(tree.root.findByProps({ testID: "sidebar-collapsed" }).props.children).toBe("true");
      act(() => tree.unmount());
    });

    it("gives the top bar the real unread count and opens the notification panel from the bell", async () => {
      const tree = await mount(1440);
      expect(tree.root.findByProps({ testID: "topstrip-unread" }).props.children).toBe("2");
      expect(present(tree, "notification-panel-open")).toBe(false);
      press(tree, "app-topstrip");
      expect(present(tree, "notification-panel-open")).toBe(true);
      act(() => tree.unmount());
    });

    it("no longer renders the NotificationBanner (the bell badge replaces it)", async () => {
      const tree = await mount(1440);
      expect(mockNotificationBanner).not.toHaveBeenCalled();
      act(() => tree.unmount());
      const phone = await mount(375);
      expect(mockNotificationBanner).not.toHaveBeenCalled();
      act(() => phone.unmount());
    });
  });

  describe("account menu data", () => {
    it("is fed the signed-in user, the company and the REAL billing accounts with the active one marked", async () => {
      const tree = await mount(1440);
      expect(JSON.parse(tree.root.findByProps({ testID: "account-sidebar-user" }).props.children)).toEqual({
        name: "Teszt Elek",
        email: "elek@teszt.hu",
      });
      expect(JSON.parse(tree.root.findByProps({ testID: "account-sidebar-company" }).props.children)).toEqual({
        name: "TestCorp Kft.",
        taxNumber: "12345678-1-42",
      });
      const accounts = JSON.parse(tree.root.findByProps({ testID: "account-sidebar-accounts" }).props.children);
      expect(accounts.map((a: { id: string; active: boolean }) => [a.id, a.active])).toEqual([
        ["u1", true],
        ["ws-1", false],
      ]);
      act(() => tree.unmount());
    });

    it("falls back to one own entry while the accounts are not loaded", async () => {
      mockWorkspaces = { accounts: [], active: null, role: "owner", inForeignAccount: false, switchTo: mockSwitchTo };
      const tree = await mount(1440);
      const accounts = JSON.parse(tree.root.findByProps({ testID: "account-sidebar-accounts" }).props.children);
      expect(accounts).toEqual([{ id: "u1", name: "TestCorp Kft.", isOwn: true, role: "owner", active: true }]);
      act(() => tree.unmount());
    });

    it("switching accounts goes through useWorkspaces (null = the person's own)", async () => {
      const tree = await mount(1440);
      press(tree, "account-sidebar-switch");
      press(tree, "account-sidebar-switch-own");
      expect(mockSwitchTo.mock.calls.map((c) => c[0])).toEqual(["ws-1", null]);
      act(() => tree.unmount());
    });

    it("manage and Cégadatok szerkesztése navigate to the settings pages", async () => {
      const tree = await mount(1440);
      press(tree, "account-sidebar-manage");
      press(tree, "account-sidebar-company-edit");
      expect(mockRouterPush.mock.calls.map((c) => c[0])).toEqual(["/settings/access", "/settings/company"]);
      act(() => tree.unmount());
    });

    it("the rail passes its collapsed state to the sidebar account button only", async () => {
      const tree = await mount(820);
      expect(tree.root.findByProps({ testID: "account-sidebar-collapsed" }).props.children).toBe("true");
      act(() => tree.unmount());
      const phone = await mount(375);
      expect(phone.root.findByProps({ testID: "account-header-collapsed" }).props.children).toBe("false");
      act(() => phone.unmount());
    });

    it("shows the foreign-account banner only when working in someone else's account", async () => {
      const own = await mount(1440);
      expect(present(own, "foreign-account-banner")).toBe(false);
      act(() => own.unmount());
      mockWorkspaces = {
        ...mockWorkspaces,
        inForeignAccount: true,
        active: { id: "ws-1", name: "Ügyfél Kft.", kind: "workspace", role: "viewer", isOwn: false },
        role: "viewer",
      };
      const foreign = await mount(1440);
      expect(present(foreign, "foreign-account-banner")).toBe(true);
      act(() => foreign.unmount());
    });
  });

  describe("logout confirm", () => {
    it("Kijelentkezés in the account menu asks first; Mégse does not sign out", async () => {
      const tree = await mount(1440);
      expect(present(tree, "logout-dialog-confirm")).toBe(false);
      press(tree, "account-sidebar-sign-out");
      expect(present(tree, "logout-dialog-confirm")).toBe(true);
      expect(mockSignOut).not.toHaveBeenCalled();
      press(tree, "logout-dialog-cancel");
      expect(present(tree, "logout-dialog-confirm")).toBe(false);
      expect(mockSignOut).not.toHaveBeenCalled();
      act(() => tree.unmount());
    });

    it("confirming signs out and returns to /login", async () => {
      const tree = await mount(1440);
      press(tree, "account-sidebar-sign-out");
      await act(async () => {
        tree.root.findByProps({ testID: "logout-dialog-confirm" }).props.onPress();
        await Promise.resolve();
      });
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith("/login");
      act(() => tree.unmount());
    });
  });

  describe("phone shell", () => {
    it("Új opens the Új sheet with the two creation routes", async () => {
      const tree = await mount(375);
      expect(present(tree, "new-sheet-invoice")).toBe(false);
      press(tree, "tab-open-new");
      press(tree, "new-sheet-invoice");
      press(tree, "new-sheet-receipt");
      expect(mockRouterPush.mock.calls.map((c) => c[0])).toEqual(["/invoices/new", "/receipts/new"]);
      act(() => tree.unmount());
    });

    it("Továbbiak opens the sheet whose Kijelentkezés opens the same confirm (it does not sign out directly)", async () => {
      const tree = await mount(375);
      expect(present(tree, "more-sheet-sign-out")).toBe(false);
      press(tree, "tab-open-more");
      press(tree, "more-sheet-sign-out");
      expect(present(tree, "logout-dialog-confirm")).toBe(true);
      expect(mockSignOut).not.toHaveBeenCalled();
      await act(async () => {
        tree.root.findByProps({ testID: "logout-dialog-confirm" }).props.onPress();
        await Promise.resolve();
      });
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith("/login");
      act(() => tree.unmount());
    });

    it("the header opens the notification panel", async () => {
      const tree = await mount(375);
      press(tree, "mobile-app-header");
      expect(present(tree, "notification-panel-open")).toBe(true);
      act(() => tree.unmount());
    });
  });
});
