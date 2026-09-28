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
});
