// components/ui/choice-pill/index.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Pressable as MockPressable } from "@/__tests__/mocks/gluestack-ui";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: Partial<React.ComponentProps<typeof ChoicePill>> = {}) {
  const onPress = props.onPress ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ChoicePill testID="test-pill" onPress={onPress} {...props}>
        <Text>label</Text>
      </ChoicePill>
    );
  });
  return { tree: tree!, onPress };
}

// findByType against the mocked Pressable's own function reference — the
// root ChoicePill element also carries testID/className as the CALLER
// passed them (unmodified), so matching by testID/className would grab the
// wrong node. The rendered <Pressable> is the only node of this exact type.
function pillOf(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findByType(MockPressable);
}

describe("ChoicePill", () => {
  it("always renders min-h-11 and items-center, even when the caller passes a conflicting className", () => {
    const { tree } = render({ className: "py-0.5 min-h-0" });
    const className = String(pillOf(tree).props.className);
    expect(className).toContain("items-center");
    expect(className).toContain(TAP_TARGET_MIN_H);
    // The floor is composed last on purpose — a caller's "min-h-0" must not
    // be able to strip it.
    expect(className.trim().endsWith(TAP_TARGET_MIN_H)).toBe(true);
  });

  it("renders min-h-11 with no caller className at all", () => {
    const { tree } = render();
    expect(String(pillOf(tree).props.className)).toContain(TAP_TARGET_MIN_H);
  });

  it("calls onPress when pressed", () => {
    const { tree, onPress } = render();
    act(() => {
      pillOf(tree).props.onPress?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const { tree, onPress } = render({ disabled: true });
    act(() => {
      pillOf(tree).props.onPress?.();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders accessibilityRole radio by default, overridable to tab", () => {
    const { tree } = render();
    expect(pillOf(tree).props.accessibilityRole).toBe("radio");

    const { tree: tabTree } = render({ accessibilityRole: "tab" });
    expect(pillOf(tabTree).props.accessibilityRole).toBe("tab");
  });

  it("sets accessibilityState from selected and disabled", () => {
    const { tree } = render({ selected: true, disabled: false });
    expect(pillOf(tree).props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });

    const { tree: disabledTree } = render({ selected: false, disabled: true });
    expect(pillOf(disabledTree).props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });
  });
});

describe("ChoicePill selected styling", () => {
  it("applies border-primary bg-primary/10 when selected, border-border bg-background otherwise", () => {
    const { tree } = render({ selected: true });
    const selectedClassName = String(pillOf(tree).props.className);
    expect(selectedClassName).toContain("border-primary");
    expect(selectedClassName).toContain("bg-primary/10");

    const { tree: unselectedTree } = render({ selected: false });
    const unselectedClassName = String(pillOf(unselectedTree).props.className);
    expect(unselectedClassName).toContain("border-border");
    expect(unselectedClassName).toContain("bg-background");
  });
});
