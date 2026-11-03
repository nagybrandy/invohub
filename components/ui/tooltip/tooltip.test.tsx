// components/ui/tooltip/tooltip.test.tsx
// Native tooltip: long-press shows it, pressing or waiting hides it.
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

import { Tooltip, TOOLTIP_AUTOHIDE_MS } from "@/components/ui/tooltip";

function render(onPress = jest.fn()) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Tooltip content="Hibás adószám">
        <Pressable testID="trigger" onPress={onPress}>
          <Text>NAV</Text>
        </Pressable>
      </Tooltip>,
    );
  });
  return { tree, onPress };
}

describe("Tooltip (native)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is hidden by default and shows on long press", () => {
    const { tree } = render();
    expect(() => tree.root.findByProps({ testID: "tooltip" })).toThrow();
    act(() => tree.root.findByProps({ testID: "trigger" }).props.onLongPress());
    expect(JSON.stringify(tree.toJSON())).toContain("Hibás adószám");
  });

  it("hides itself after the auto-hide delay", () => {
    const { tree } = render();
    act(() => tree.root.findByProps({ testID: "trigger" }).props.onLongPress());
    act(() => {
      jest.advanceTimersByTime(TOOLTIP_AUTOHIDE_MS + 10);
    });
    expect(() => tree.root.findByProps({ testID: "tooltip" })).toThrow();
  });

  it("pressing the trigger hides it and still runs the original press", () => {
    const { tree, onPress } = render();
    act(() => tree.root.findByProps({ testID: "trigger" }).props.onLongPress());
    act(() => tree.root.findByProps({ testID: "trigger" }).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(() => tree.root.findByProps({ testID: "tooltip" })).toThrow();
  });
});
