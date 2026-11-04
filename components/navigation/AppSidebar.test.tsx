// components/navigation/AppSidebar.test.tsx
// The navy sidebar: 248 / 72px, head with logo + collapse toggle, the split
// create button, six primary rows in order, the real secondary rows, the
// account slot in the footer; the rail carries tooltips instead of labels.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { routes } from "@/lib/navigation";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ onNavy: "#ccd", onNavyActive: "#fff" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "pressable", "text", "vstack"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ content, children }: { content: string; children: React.ReactNode }) => {
    const { View } = require("react-native");
    return <View testID="tooltip-wrapper" accessibilityHint={content}>{children}</View>;
  },
}));
jest.mock("@/components/navigation/NewCreateButton", () => ({
  NewCreateButton: (props: { collapsed?: boolean; onNewInvoice: () => void }) => {
    const { Pressable, Text } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="stub-create" onPress={props.onNewInvoice}>
        <Text>{`create:${String(props.collapsed)}`}</Text>
      </Pressable>
    );
  },
}));

function render(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  const handlers = {
    onToggleCollapsed: jest.fn(),
    onNavigate: jest.fn(),
    onNewInvoice: jest.fn(),
    onNewReceipt: jest.fn(),
    onNewPartner: jest.fn(),
  };
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <AppSidebar
        activePathname="/dashboard"
        role="entrepreneur"
        collapsed={false}
        accountMenu={<></>}
        {...handlers}
        {...props}
      />,
    );
  });
  const row = (id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === "function")[0];
  return { tree, row, ...handlers };
}

describe("AppSidebar", () => {
  it("is navy, 248px wide and uses the white focus ring on navy", () => {
    const { tree } = render();
    const root = tree.root.findByProps({ testID: "app-sidebar" });
    expect(root.props.className).toContain("bg-navy");
    expect(root.props.className).toContain("on-navy");
    expect(root.props.style).toEqual({ width: 248 });
  });

  it("collapses to a 72px rail", () => {
    expect(render({ collapsed: true }).tree.root.findByProps({ testID: "app-sidebar" }).props.style).toEqual({ width: 72 });
  });

  it("head: the logo link and the collapse toggle (labelled for the state)", () => {
    const { tree, row, onToggleCollapsed } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("shell.brand");
    expect(row("sidebar-collapse-toggle").props.accessibilityLabel).toBe("nav.collapseSidebar");
    act(() => row("sidebar-collapse-toggle").props.onPress());
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    const rail = render({ collapsed: true });
    expect(rail.row("sidebar-collapse-toggle").props.accessibilityLabel).toBe("nav.expandSidebar");
    expect(JSON.stringify(rail.tree.toJSON())).not.toContain("shell.brand");
  });

  it("the logo goes home", () => {
    const { row, onNavigate } = render();
    act(() => row("sidebar-logo").props.onPress());
    expect(onNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("renders the split create button between the head and the nav, passing the collapsed state", () => {
    const { tree } = render({ collapsed: true });
    expect(JSON.stringify(tree.toJSON())).toContain("create:true");
  });

  it("lists the six primary rows in order: Főoldal, Számlák, Nyugták, Partnerek, Termékek, Beállítások", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    const keys = ["nav.dashboard", "nav.invoices", "nav.receipts", "nav.partners", "nav.products", "nav.settings"];
    const at = keys.map((k) => json.indexOf(`"${k}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("lists the real secondary rows (no Importálás unless enabled, Admin only for admins)", () => {
    const user = JSON.stringify(render().tree.toJSON());
    for (const key of ["nav.emailEditor", "nav.dataExport", "nav.bulkUpload"]) expect(user).toContain(key);
    expect(user).not.toContain("nav.admin");
    expect(JSON.stringify(render({ role: "admin" }).tree.toJSON())).toContain("nav.admin");
  });

  it("highlights the active row and navigates on press", () => {
    const { row, onNavigate } = render({ activePathname: "/invoices/abc" });
    expect(row("sidebar-nav-invoices").props.accessibilityState).toMatchObject({ selected: true });
    expect(row("sidebar-nav-invoices").props.className).toContain("bg-white/10");
    expect(row("sidebar-nav-dashboard").props.accessibilityState).toMatchObject({ selected: false });
    act(() => row("sidebar-nav-partners").props.onPress());
    expect(onNavigate).toHaveBeenCalledWith(routes.clients);
  });

  it("rows are 10px-radius-8 links with 9/12 padding expanded, centred 11/0 when collapsed", () => {
    expect(render().row("sidebar-nav-invoices").props.className).toContain("px-3 py-[9px]");
    expect(render({ collapsed: true }).row("sidebar-nav-invoices").props.className).toContain("justify-center");
    expect(render().row("sidebar-nav-invoices").props.accessibilityRole).toBe("link");
  });

  it("the rail shows no labels but gives every row a tooltip carrying the label", () => {
    const rail = render({ collapsed: true });
    const hints = rail.tree.root.findAllByProps({ testID: "tooltip-wrapper" }).map((n) => n.props.accessibilityHint);
    for (const key of ["nav.dashboard", "nav.invoices", "nav.receipts", "nav.partners", "nav.products", "nav.settings", "nav.dataExport"]) {
      expect(hints).toContain(key);
    }
    expect(JSON.stringify(rail.tree.toJSON())).not.toMatch(/"children":\["nav\./);
    // expanded: no tooltips
    expect(render().tree.root.findAllByProps({ testID: "tooltip-wrapper" })).toHaveLength(0);
  });

  it("puts the account menu in the footer, below the nav", () => {
    const { tree } = render({ accountMenu: <></> });
    expect(tree.root.findByProps({ testID: "app-sidebar" })).toBeTruthy();
    const withMenu = render({
      accountMenu: React.createElement(require("react-native").Text, { testID: "footer-slot" }, "ACCOUNT"),
    });
    const json = JSON.stringify(withMenu.tree.toJSON());
    expect(json.indexOf("ACCOUNT")).toBeGreaterThan(json.indexOf("nav.settings"));
    expect(json.indexOf("ACCOUNT")).toBeGreaterThan(json.indexOf("nav.dataExport"));
  });
});
