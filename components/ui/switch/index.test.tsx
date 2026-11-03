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

  it("keeps a 44px touch target around the 44x26 track (tokens.md §6.17)", () => {
    const tree = render(<Switch value onValueChange={() => {}} accessibilityLabel="NAV" />);
    const root = tree.root.findAll((n) => n.props?.accessibilityRole === "switch")[0];

    expect(String(root.props.className)).toMatch(/h-11/);
    expect(String(root.props.className)).toMatch(/w-11/);
    const classes = tree.root.findAll((n) => typeof n.props?.className === "string").map((n) => n.props.className as string);
    expect(classes.some((c) => c.includes("h-[26px] w-[44px]"))).toBe(true);
    expect(classes.some((c) => c.includes("h-5 w-5"))).toBe(true);
  });

  it("is primary when on and line-strong when off", () => {
    const on = render(<Switch value onValueChange={() => {}} accessibilityLabel="NAV" />);
    const off = render(<Switch value={false} onValueChange={() => {}} accessibilityLabel="NAV" />);
    const track = (t: TestRenderer.ReactTestRenderer) =>
      t.root.findAll((n) => typeof n.props?.className === "string" && n.props.className.includes("w-[44px]"))[0];
    expect(String(track(on).props.className)).toContain("bg-primary");
    expect(String(track(off).props.className)).toContain("bg-line-strong");
  });

  it("flips with a press and not when disabled", () => {
    const onValueChange = jest.fn();
    const tree = render(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="NAV" />);
    const root = tree.root.findAll((n) => n.props?.accessibilityRole === "switch")[0];
    TestRenderer.act(() => root.props.onPress());
    expect(onValueChange).toHaveBeenCalledWith(true);
    const disabled = render(<Switch value disabled onValueChange={onValueChange} accessibilityLabel="NAV" />);
    expect(disabled.root.findAll((n) => n.props?.accessibilityRole === "switch")[0].props.disabled).toBe(true);
  });
});
