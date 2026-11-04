// components/navigation/AccountMenu.test.tsx
// The account button + menu: the signed-in user, the REAL billing accounts
// with a check on the active one (switching works), Cégadatok szerkesztése,
// and Kijelentkezés last. (Absorbs the assertions of the former UserMenu and
// AccountSwitcher tests.)
import TestRenderer, { act } from "react-test-renderer";
import { AccountMenu, type AccountMenuAccount } from "@/components/navigation/AccountMenu";

const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", primary: "#00f", foreground: "#000", onNavy: "#ccd" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "pressable", "text", "heading"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

const accounts: AccountMenuAccount[] = [
  { id: "p1", name: "Kovács Anna", isOwn: true, role: "owner", active: true },
  { id: "ws-aaaaaa", name: "Ügyfél Kft.", isOwn: false, role: "accountant", active: false },
];

function render(props: Partial<React.ComponentProps<typeof AccountMenu>> = {}) {
  const handlers = {
    onSwitch: jest.fn(),
    onManage: jest.fn(),
    onEditCompany: jest.fn(),
    onSignOut: jest.fn(),
  };
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <AccountMenu
        variant="sidebar"
        user={{ name: "Kovács Anna", email: "anna@demo.invohub.hu" }}
        company={{ name: "Kovács Anna e.v.", taxNumber: "66123456-1-33" }}
        accounts={accounts}
        {...handlers}
        {...props}
      />,
    );
  });
  return { tree, ...handlers };
}

const byId = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props?.testID === testID && typeof n.props.onPress === "function")[0];
const open = (tree: TestRenderer.ReactTestRenderer) => act(() => byId(tree, "account-button").props.onPress());

beforeEach(() => {
  mockDims.width = 1440;
});

describe("AccountMenu trigger", () => {
  it("shows the company name and tax number on the sidebar button", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Kovács Anna e.v.");
    expect(json).toContain("66123456-1-33");
    expect(json).toContain('"KA"');
    const button = byId(tree, "account-button");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("shell.account.button");
    expect(button.props.accessibilityState).toMatchObject({ expanded: false });
  });

  it("collapsed (the rail): only the avatar, the label carries the name", () => {
    const { tree } = render({ collapsed: true });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("66123456-1-33");
    expect(byId(tree, "account-button").props.accessibilityLabel).toContain("Kovács Anna e.v.");
  });

  it("the phone header variant shows the name with a chevron", () => {
    mockDims.width = 375;
    const { tree } = render({ variant: "header" });
    expect(JSON.stringify(tree.toJSON())).toContain("Kovács Anna e.v.");
    expect(tree.root.findAllByProps({ testID: "icon-ChevronDown" }).length).toBeGreaterThan(0);
  });
});

describe("AccountMenu content", () => {
  it("is closed until the button is pressed", () => {
    const { tree } = render();
    expect(() => tree.root.findByProps({ testID: "account-menu" })).toThrow();
    open(tree);
    expect(tree.root.findByProps({ testID: "account-menu" })).toBeTruthy();
    expect(byId(tree, "account-button").props.accessibilityState).toMatchObject({ expanded: true });
  });

  it("lists the signed-in user, the real accounts with a check on the active one", () => {
    const { tree } = render();
    open(tree);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("shell.account.signedIn");
    expect(json).toContain("anna@demo.invohub.hu");
    expect(json).toContain("shell.account.companies");
    expect(json).toContain("Ügyfél Kft.");
    expect(json).toContain("accounts.roles.accountant");
    expect(json).toContain("66123456-1-33");
    // the check is on the active row only
    expect(byId(tree, "account-option-p1").findAllByProps({ testID: "icon-Check" }).length).toBeGreaterThan(0);
    expect(byId(tree, "account-option-ws-aaaaaa").findAllByProps({ testID: "icon-Check" }).length).toBe(0);
    expect(byId(tree, "account-option-p1").props.accessibilityState).toMatchObject({ selected: true });
    expect(byId(tree, "account-option-ws-aaaaaa").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("switches to another account (null for the person's own) and closes", () => {
    const first = render();
    open(first.tree);
    act(() => byId(first.tree, "account-option-ws-aaaaaa").props.onPress());
    expect(first.onSwitch).toHaveBeenCalledWith("ws-aaaaaa");
    expect(() => first.tree.root.findByProps({ testID: "account-menu" })).toThrow();

    const second = render({
      accounts: [
        { ...accounts[0], active: false },
        { ...accounts[1], active: true },
      ],
    });
    open(second.tree);
    act(() => byId(second.tree, "account-option-p1").props.onPress());
    expect(second.onSwitch).toHaveBeenCalledWith(null);
  });

  it("does nothing when the active account is picked again", () => {
    const { tree, onSwitch } = render();
    open(tree);
    act(() => byId(tree, "account-option-p1").props.onPress());
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("Számlázófiókok kezelése and Cégadatok szerkesztése navigate and close the menu", () => {
    const manage = render();
    open(manage.tree);
    act(() => byId(manage.tree, "account-manage").props.onPress());
    expect(manage.onManage).toHaveBeenCalledTimes(1);
    expect(() => manage.tree.root.findByProps({ testID: "account-menu" })).toThrow();

    const edit = render();
    open(edit.tree);
    act(() => byId(edit.tree, "account-edit-company").props.onPress());
    expect(edit.onEditCompany).toHaveBeenCalledTimes(1);
  });

  it("Kijelentkezés is the LAST row and asks the shell for the confirm (it does not sign out itself)", () => {
    const { tree, onSignOut } = render();
    open(tree);
    const items = tree.root.findAll((n) => n.props?.accessibilityRole === "menuitem" && typeof n.props.onPress === "function");
    const ids = items.map((n) => n.props.testID);
    expect(ids[ids.length - 1]).toBe("account-sign-out");
    act(() => byId(tree, "account-sign-out").props.onPress());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(() => tree.root.findByProps({ testID: "account-menu" })).toThrow();
  });

  it("rows are menuitems with the 44px floor", () => {
    const { tree } = render();
    open(tree);
    for (const id of ["account-option-p1", "account-manage", "account-edit-company", "account-sign-out"]) {
      expect(byId(tree, id).props.accessibilityRole).toBe("menuitem");
      expect(byId(tree, id).props.className).toContain("min-h-11");
    }
  });

  it("opens as a bottom sheet on phones", () => {
    mockDims.width = 375;
    const { tree } = render({ variant: "header" });
    act(() => byId(tree, "account-button").props.onPress());
    expect(tree.root.findByProps({ testID: "account-sheet" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "account-menu" })).toBeTruthy();
  });
});
