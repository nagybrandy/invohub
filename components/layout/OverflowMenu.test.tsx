// components/layout/OverflowMenu.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { MAX_MENU_ITEMS, OverflowMenu } from "@/components/layout/OverflowMenu";

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
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof OverflowMenu>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<OverflowMenu {...props} />);
  });
  return tree!;
}

describe("OverflowMenu", () => {
  it("is closed by default", () => {
    const tree = render({ items: [{ label: "Szerkesztés", onPress: jest.fn() }] });
    expect(() => tree.root.findByProps({ testID: "overflow-menu-content" })).toThrow();
  });

  it("opens the list on trigger press", () => {
    const tree = render({ items: [{ label: "Szerkesztés", onPress: jest.fn() }] });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress();
    });
    expect(tree.root.findByProps({ testID: "overflow-menu-content" })).toBeTruthy();
  });

  it("calls the item's onPress and closes the menu", () => {
    const onPress = jest.fn();
    const tree = render({ items: [{ label: "Törlés", onPress }] });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress();
    });
    const menuItem = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    act(() => {
      menuItem.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(() => tree.root.findByProps({ testID: "overflow-menu-content" })).toThrow();
  });

  it("trigger is the 34px (40 on phones) icon button and menu rows keep the 44px floor", () => {
    const tree = render({
      items: [
        { label: "Szerkesztés", onPress: jest.fn() },
        { label: "Törlés", onPress: jest.fn(), destructive: true },
      ],
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    expect(trigger.props.className).toContain("h-[34px] w-[34px]");
    expect(trigger.props.className).toContain("phone:h-10 phone:w-10");
    expect(trigger.props.hitSlop).toEqual(8);

    act(() => {
      trigger.props.onPress();
    });
    const item0 = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    const item1 = tree.root.findByProps({ testID: "overflow-menu-item-1" });
    expect(item0.props.className).toContain("min-h-11");
    expect(item1.props.className).toContain("min-h-11");
  });

  it("renders multiple items and marks destructive ones", () => {
    const tree = render({
      items: [
        { label: "Szerkesztés", onPress: jest.fn() },
        { label: "Törlés", onPress: jest.fn(), destructive: true },
      ],
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress();
    });
    // react-test-renderer's findAllByProps matches every fiber layer
    // (composite + host through forwardRef in the gluestack mocks), so
    // presence/style is checked via a unique props match rather than a count.
    const editText = tree.root.findByProps({ children: "Szerkesztés" });
    expect(editText.props.className).toContain("text-ink");
    const destructiveText = tree.root.findByProps({ children: "Törlés" });
    expect(destructiveText.props.className).toContain("text-err");
  });
});

describe("OverflowMenu design limits (tokens.md §6.14)", () => {
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ label: `Művelet ${i + 1}`, onPress: jest.fn() }));

  afterEach(() => jest.restoreAllMocks());

  it("allows at most five actions without complaint", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(MAX_MENU_ITEMS).toBe(5);
    render({ items: items(5) });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns in development when more than five actions are passed", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    render({ items: items(6) });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("at most 5"));
  });

  it("uses the menu surface: line-strong border, 12px radius, menu shadow, 230px min width", () => {
    const tree = render({ items: items(2) });
    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.onPress({});
    });
    const content = tree.root.findByProps({ testID: "overflow-menu-content" });
    for (const c of ["border-line-strong", "rounded-menu", "shadow-menu", "min-w-[230px]", "bg-surface"]) {
      expect(content.props.className).toContain(c);
    }
  });

  it("rows are menuitems; the trigger reports expanded", () => {
    const tree = render({ items: items(2) });
    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.onPress({});
    });
    expect(tree.root.findByProps({ testID: "overflow-menu-item-0" }).props.accessibilityRole).toBe("menuitem");
    expect(tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });
});
