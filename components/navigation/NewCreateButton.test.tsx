// components/navigation/NewCreateButton.test.tsx
// The split "Új számla" button: main = new invoice; arrow = a menu with exactly
// Új számla, Új nyugta, Új partner; Esc returns focus to the arrow; collapsed
// is a 44px "+" with no arrow.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", onNavyActive: "#fff" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "text"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
// A Pressable that exposes focus() through its ref, so "focus returns to the
// arrow" can be asserted.
const mockFocus = jest.fn();
jest.mock("@/components/ui/pressable", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    Pressable: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ focus: mockFocus }));
      return <Pressable {...props} />;
    }),
  };
});

// The popover is replaced by a stub that renders its anchor, and its content
// only while open, and records the props NewCreateButton hands it.
const popoverProps: { current: Record<string, unknown> } = { current: {} };
jest.mock("@/components/layout/AnchoredPopover", () => ({
  MENU_PANEL_CLASS: "menu-panel",
  AnchoredPopover: (props: { open: boolean; anchor: React.ReactNode; children: React.ReactNode }) => {
    popoverProps.current = props as never;
    return (
      <>
        {props.anchor}
        {props.open ? props.children : null}
      </>
    );
  },
}));

import { NewCreateButton } from "@/components/navigation/NewCreateButton";

function render(props: Partial<React.ComponentProps<typeof NewCreateButton>> = {}) {
  const handlers = { onNewInvoice: jest.fn(), onNewReceipt: jest.fn(), onNewPartner: jest.fn() };
  const focus = mockFocus;
  focus.mockClear();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NewCreateButton {...handlers} {...props} />);
  });
  return { tree, focus, ...handlers };
}

const byId = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === "function")[0];

describe("NewCreateButton (expanded)", () => {
  it("the main part opens a new invoice", () => {
    const { tree, onNewInvoice } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("nav.newInvoice");
    act(() => byId(tree, "new-create-main").props.onPress());
    expect(onNewInvoice).toHaveBeenCalledTimes(1);
  });

  it("is 42px high with a 38px arrow part separated by a divider", () => {
    const { tree } = render();
    const root = tree.root.findByProps({ testID: "new-create-button" });
    expect(root.props.className).toContain("h-[42px]");
    expect(root.props.className).toContain("bg-primary");
    const arrow = byId(tree, "new-create-arrow");
    expect(arrow.props.className).toContain("w-[38px]");
    expect(arrow.props.className).toContain("border-l");
  });

  it("the menu is closed until the arrow is pressed", () => {
    const { tree } = render();
    expect(() => tree.root.findByProps({ testID: "new-create-menu" })).toThrow();
    expect(byId(tree, "new-create-arrow").props.accessibilityState).toMatchObject({ expanded: false });
    act(() => byId(tree, "new-create-arrow").props.onPress());
    expect(tree.root.findByProps({ testID: "new-create-menu" })).toBeTruthy();
    expect(byId(tree, "new-create-arrow").props.accessibilityState).toMatchObject({ expanded: true });
  });

  it("offers exactly Új számla, Új nyugta and Új partner, in that order", () => {
    const { tree } = render();
    act(() => byId(tree, "new-create-arrow").props.onPress());
    const items = tree.root.findAll((n) => n.props?.accessibilityRole === "menuitem" && typeof n.props.onPress === "function");
    expect(Array.from(new Set(items.map((n) => n.props.testID)))).toEqual([
      "new-create-invoice",
      "new-create-receipt",
      "new-create-partner",
    ]);
    const json = JSON.stringify(tree.toJSON());
    expect(json.indexOf("nav.newReceipt")).toBeLessThan(json.indexOf("nav.newPartner"));
  });

  it.each([
    ["new-create-invoice", "onNewInvoice"],
    ["new-create-receipt", "onNewReceipt"],
    ["new-create-partner", "onNewPartner"],
  ] as const)("%s runs %s and closes the menu", (testID, handler) => {
    const result = render();
    act(() => byId(result.tree, "new-create-arrow").props.onPress());
    act(() => byId(result.tree, testID).props.onPress());
    expect(result[handler]).toHaveBeenCalledTimes(1);
    expect(() => result.tree.root.findByProps({ testID: "new-create-menu" })).toThrow();
  });

  it("closes on Esc and returns focus to the ARROW", () => {
    const { tree, focus } = render();
    act(() => byId(tree, "new-create-arrow").props.onPress());
    act(() => (popoverProps.current.onEscape as () => void)());
    expect(focus).toHaveBeenCalled();
    act(() => (popoverProps.current.onClose as () => void)());
    expect(() => tree.root.findByProps({ testID: "new-create-menu" })).toThrow();
  });

  it("opens the popover left-aligned under the button as a menu", () => {
    render();
    expect(popoverProps.current.align).toBe("left");
    expect(popoverProps.current.role).toBe("menu");
    expect(popoverProps.current.width).toBe(230);
  });
});

describe("NewCreateButton (collapsed)", () => {
  it("is a 44px '+' that opens a new invoice, with no arrow and no menu", () => {
    const { tree, onNewInvoice } = render({ collapsed: true });
    const button = byId(tree, "new-create-button");
    expect(button.props.className).toContain("h-11 w-11");
    expect(button.props.accessibilityLabel).toBe("shell.newMenu.collapsedMain");
    act(() => button.props.onPress());
    expect(onNewInvoice).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ testID: "new-create-arrow" }).length).toBe(0);
  });
});
