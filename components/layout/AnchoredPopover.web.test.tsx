/** @jest-environment jsdom */
// components/layout/AnchoredPopover.web.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { AnchoredPopover } from "@/components/layout/AnchoredPopover.web";

jest.mock("react-dom", () => ({ createPortal: (children: React.ReactNode) => children }));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));

function render(open: boolean, onClose = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <AnchoredPopover open={open} onClose={onClose} anchor={<Text>gomb</Text>} testID="pop">
        <Text>tartalom</Text>
      </AnchoredPopover>,
    );
  });
  return tree;
}

describe("AnchoredPopover (web)", () => {
  it("renders nothing but the anchor while closed", () => {
    const tree = render(false);
    expect(tree.root.findAllByProps({ "data-testid": "pop" })).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain("gomb");
  });

  it("opens as a fixed-position panel with its style on the node itself, holding the children", () => {
    const tree = render(true);
    const panel = tree.root.findByProps({ "data-testid": "pop" });
    expect(panel.props.style).toMatchObject({ position: "fixed", zIndex: 1000, width: 360 });
    expect(typeof panel.props.style.top).toBe("number");
    expect(JSON.stringify(tree.toJSON())).toContain("tartalom");
  });

  it("closes on Escape", () => {
    const onClose = jest.fn();
    render(true, onClose);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports Escape through onEscape (so the caller can refocus its trigger) before closing", () => {
    const calls: string[] = [];
    act(() => {
      TestRenderer.create(
        <AnchoredPopover
          open
          onClose={() => calls.push("close")}
          onEscape={() => calls.push("escape")}
          anchor={<Text>gomb</Text>}
        >
          <Text>tartalom</Text>
        </AnchoredPopover>,
      );
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(calls).toEqual(["escape", "close"]);
  });

  it("closes on a press outside, not on a press inside the anchor", () => {
    const onClose = jest.fn();
    render(true, onClose);
    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("placement=above anchors the panel by its bottom edge (the sidebar account menu opens upward)", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AnchoredPopover open onClose={jest.fn()} anchor={<Text>gomb</Text>} placement="above" testID="pop">
          <Text>tartalom</Text>
        </AnchoredPopover>,
      );
    });
    const style = tree.root.findByProps({ "data-testid": "pop" }).props.style;
    expect(typeof style.bottom).toBe("number");
    expect(style.top).toBeUndefined();
  });

  it("takes the panel look and role from props (menus)", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AnchoredPopover
          open
          onClose={jest.fn()}
          anchor={<Text>gomb</Text>}
          role="menu"
          panelClassName="menu-look"
          width={230}
          testID="pop"
        >
          <Text>tartalom</Text>
        </AnchoredPopover>,
      );
    });
    const panel = tree.root.findByProps({ "data-testid": "pop" });
    expect(panel.props.role).toBe("menu");
    expect(panel.props.className).toBe("menu-look");
    expect(panel.props.style.width).toBe(230);
  });
});
