/** @jest-environment jsdom */
// components/layout/OverflowMenu.web.test.tsx
// Regression coverage for the row-menu-in-a-table stacking-context bug:
// every Box/View gets `position: relative; z-index: 0` from the shared
// reset, so each table row is its own stacking context and an
// absolutely-positioned dropdown nested in one row can never escape it to
// sit above a later sibling row — clicks silently landed on whatever cell
// was underneath instead of the visible menu item (confirmed live in a
// real browser: opening a partner row's "⋯" menu and clicking "Számla
// ennek a partnernek" navigated to a DIFFERENT row's edit screen).
//
// The fix portals the menu to document.body instead of an ancestor-
// relative absolute box. `react-test-renderer` can't host a real DOM
// portal target (createPortal is react-dom-specific), so this test mocks
// createPortal to render inline — real portal escape is a browser-only
// concern and was verified live, not here — while still exercising the
// component's own logic: it opens, renders every item, and each item's
// onPress fires exactly once and closes the menu.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { OverflowMenu } from "@/components/layout/OverflowMenu.web";

jest.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof OverflowMenu>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<OverflowMenu {...props} />);
  });
  return tree!;
}

describe("OverflowMenu (web)", () => {
  it("renders nothing (no trigger) when there are no items", () => {
    const tree = render({ items: [] });
    expect(tree.toJSON()).toBeNull();
  });

  it("opens on trigger press and renders every item, even without a real DOM ref", () => {
    const tree = render({
      items: [
        { label: "Számla ennek a partnernek", onPress: jest.fn() },
        { label: "Szerkesztés", onPress: jest.fn() },
        { label: "Törlés", onPress: jest.fn(), destructive: true },
      ],
    });

    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.onPress?.();
    });

    expect(tree.root.findByProps({ testID: "overflow-menu-item-0" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "overflow-menu-item-1" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "overflow-menu-item-2" })).toBeTruthy();
  });

  it("trigger and menu items clear the 44px tap-target floor", () => {
    const tree = render({
      items: [
        { label: "Szerkesztés", onPress: jest.fn() },
        { label: "Törlés", onPress: jest.fn(), destructive: true },
      ],
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    expect(trigger.props.className).toContain("h-11 w-11");
    expect(trigger.props.hitSlop).toEqual(8);

    act(() => {
      trigger.props.onPress?.();
    });
    const item0 = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    const item1 = tree.root.findByProps({ testID: "overflow-menu-item-1" });
    expect(item0.props.className).toContain("min-h-11");
    expect(item1.props.className).toContain("min-h-11");
  });

  it("calls the pressed item's own onPress — never a different item's — and closes the menu", () => {
    const onInvoiceFor = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const tree = render({
      items: [
        { label: "Számla ennek a partnernek", onPress: onInvoiceFor },
        { label: "Szerkesztés", onPress: onEdit },
        { label: "Törlés", onPress: onDelete, destructive: true },
      ],
    });

    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.onPress?.();
    });
    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-item-0" }).props.onPress?.();
    });

    expect(onInvoiceFor).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    // Menu closed — its items are no longer in the tree.
    expect(() => tree.root.findByProps({ testID: "overflow-menu-item-0" })).toThrow();
  });
});
