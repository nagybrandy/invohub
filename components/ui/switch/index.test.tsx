// components/ui/switch/index.test.tsx
import * as React from "react";
import TestRenderer from "react-test-renderer";
import { Switch } from "@/components/ui/switch";

function render(el: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    tree = TestRenderer.create(el);
  });
  return tree;
}

describe("Switch accessibility", () => {
  it("reports its on/off state to assistive tech on both platforms", () => {
    const on = render(<Switch value onValueChange={() => {}} accessibilityLabel="NAV" />);
    const root = on.root.findAll((n) => n.props?.accessibilityRole === "switch")[0];

    expect(root.props.accessibilityState).toMatchObject({ checked: true });
    // RN Web does not derive aria-checked from accessibilityState for a
    // custom Pressable, so it is set explicitly — without it a screen
    // reader cannot tell whether NAV submission is on.
    expect(root.props["aria-checked"]).toBe(true);

    const off = render(<Switch value={false} onValueChange={() => {}} accessibilityLabel="NAV" />);
    const offRoot = off.root.findAll((n) => n.props?.accessibilityRole === "switch")[0];
    expect(offRoot.props["aria-checked"]).toBe(false);
  });

  it("keeps a 44px touch target around the 40x22 track", () => {
    const tree = render(<Switch value onValueChange={() => {}} accessibilityLabel="NAV" />);
    const root = tree.root.findAll((n) => n.props?.accessibilityRole === "switch")[0];

    expect(String(root.props.className)).toMatch(/h-11/);
    expect(String(root.props.className)).toMatch(/w-11/);
  });
});
