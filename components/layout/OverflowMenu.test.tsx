// components/layout/OverflowMenu.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { OverflowMenu } from "@/components/layout/OverflowMenu";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    expect(() => tree.root.findByProps({ testID: "overflow-menu-list" })).toThrow();
  });

  it("opens the list on trigger press", () => {
    const tree = render({ items: [{ label: "Szerkesztés", onPress: jest.fn() }] });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress();
    });
    expect(tree.root.findByProps({ testID: "overflow-menu-list" })).toBeTruthy();
  });

  it("calls the item's onPress and closes the menu", () => {
    const onPress = jest.fn();
    const tree = render({ items: [{ label: "Törlés", onPress }] });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress();
    });
    const menuItem = tree.root.findByProps({ testID: "overflow-menu-item" });
    act(() => {
      menuItem.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(() => tree.root.findByProps({ testID: "overflow-menu-list" })).toThrow();
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
    expect(editText.props.className).toContain("text-foreground");
    const destructiveText = tree.root.findByProps({ children: "Törlés" });
    expect(destructiveText.props.className).toContain("text-destructive");
  });
});
