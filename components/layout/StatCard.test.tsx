// components/layout/StatCard.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { StatCard } from "@/components/layout/StatCard";

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof StatCard>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<StatCard {...props} />);
  });
  return tree!;
}

describe("StatCard", () => {
  it("keeps the old { label, value, hint } shape working unchanged", () => {
    const tree = render({ label: "Összesen", value: 12, hint: "12 számla" });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Összesen");
    expect(texts).toContain("12 számla");
  });

  it("defaults to neutral tone (not green)", () => {
    const tree = render({ label: "Kintlévőség", value: "100 000 Ft" });
    const value = tree.root.findByProps({ children: "100 000 Ft" });
    expect(value.props.className).not.toMatch(/15803d/);
  });

  it("tone=positive renders the approved paid-only green", () => {
    const tree = render({ label: "E havi bevétel", value: "500 000 Ft", tone: "positive" });
    const value = tree.root.findByProps({ children: "500 000 Ft" });
    expect(value.props.className).toContain("#15803d");
  });

  it("tone=critical renders destructive color", () => {
    const tree = render({ label: "Lejárt", value: "50 000 Ft", tone: "critical" });
    const value = tree.root.findByProps({ children: "50 000 Ft" });
    expect(value.props.className).toContain("text-destructive");
  });

  it("is pressable and calls onPress", () => {
    const onPress = jest.fn();
    const tree = render({ label: "Kintlévőség", value: "0 Ft", onPress });
    const pressable = tree.root.findByProps({ testID: "stat-card-pressable" });
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not wrapped in a Pressable when onPress is absent", () => {
    const tree = render({ label: "Kintlévőség", value: "0 Ft" });
    expect(() => tree.root.findByProps({ testID: "stat-card-pressable" })).toThrow();
  });

  it("loading renders a skeleton instead of the value", () => {
    const tree = render({ label: "Kintlévőség", value: "0 Ft", loading: true });
    expect(tree.root.findByProps({ testID: "stat-card-skeleton" })).toBeTruthy();
    expect(() => tree.root.findByProps({ children: "0 Ft" })).toThrow();
  });
});
