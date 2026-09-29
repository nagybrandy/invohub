// components/layout/AnchoredPopover.test.tsx — native variant
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal, Text } from "react-native";
import { AnchoredPopover } from "@/components/layout/AnchoredPopover";

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

describe("AnchoredPopover (native)", () => {
  it("drives a transparent Modal with the open flag", () => {
    expect(render(false).root.findByType(Modal).props.visible).toBe(false);
    const openTree = render(true);
    expect(openTree.root.findByType(Modal).props.visible).toBe(true);
    expect(openTree.root.findByType(Modal).props.transparent).toBe(true);
  });

  it("closes from the backdrop and from the OS back gesture", () => {
    const onClose = jest.fn();
    const tree = render(true, onClose);
    act(() => tree.root.findByProps({ testID: "pop-backdrop" }).props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the children as soon as it is open — before (or without) a measurement", () => {
    const tree = render(true);
    expect(JSON.stringify(tree.toJSON())).toContain("tartalom");
    expect(tree.root.findAllByProps({ testID: "pop" }).length).toBeGreaterThan(0);
  });
});
