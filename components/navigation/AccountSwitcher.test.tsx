import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccountSwitcher } from "@/components/navigation/AccountSwitcher";
import { ForeignAccountBanner } from "@/components/navigation/ForeignAccountBanner";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ muted: "#666", primary: "#00f" }) }));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "pressable", "text", "vstack", "hstack"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

const accounts = [
  { id: "p1", name: "Kovács Anna", kind: "person" as const, role: "owner" as const, isOwn: true },
  { id: "ws-aaaaaa", name: "Ügyfél Kft.", kind: "workspace" as const, role: "accountant" as const, isOwn: false },
];

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findAll((n) => n.props?.testID === testID && typeof n.props.onPress === "function")[0];
  act(() => node.props.onPress());
}

describe("AccountSwitcher", () => {
  function render(activeIndex = 0) {
    const switchTo = jest.fn();
    const onManage = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<AccountSwitcher workspaces={{ accounts, active: accounts[activeIndex], switchTo }} onManage={onManage} />);
    });
    return { tree, switchTo, onManage };
  }

  it("shows the active account and lists all accounts when opened", () => {
    const { tree } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("Kovács Anna");
    expect(JSON.stringify(tree.toJSON())).not.toContain("Ügyfél Kft.");
    press(tree, "account-switcher-button");
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Ügyfél Kft.");
    expect(json).toContain("accounts.roles.accountant");
    expect(json).toContain("accounts.own");
  });

  it("switches to another account, using null for the person's own", () => {
    const a = render(0);
    press(a.tree, "account-switcher-button");
    press(a.tree, "account-option-ws-aaaaaa");
    expect(a.switchTo).toHaveBeenCalledWith("ws-aaaaaa");

    const b = render(1);
    press(b.tree, "account-switcher-button");
    press(b.tree, "account-option-p1");
    expect(b.switchTo).toHaveBeenCalledWith(null);
  });

  it("does nothing when the active account is picked again, and opens the access settings", () => {
    const { tree, switchTo, onManage } = render(0);
    press(tree, "account-switcher-button");
    press(tree, "account-option-p1");
    expect(switchTo).not.toHaveBeenCalled();
    press(tree, "account-switcher-button");
    press(tree, "account-manage");
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it("renders nothing before the accounts are known", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<AccountSwitcher workspaces={{ accounts: [], active: null, switchTo: jest.fn() }} onManage={jest.fn()} />);
    });
    expect(tree.toJSON()).toBeNull();
  });
});

describe("ForeignAccountBanner", () => {
  it("says where you are working and offers the way back; read-only is spelled out", () => {
    const onBack = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ForeignAccountBanner accountName="Ügyfél Kft." role="viewer" onBack={onBack} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Ügyfél Kft.");
    expect(json).toContain("accounts.readOnly");
    press(tree, "foreign-account-back");
    expect(onBack).toHaveBeenCalled();
  });
});
