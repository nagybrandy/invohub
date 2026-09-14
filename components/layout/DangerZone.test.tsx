// components/layout/DangerZone.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { DangerZone } from "@/components/layout/DangerZone";

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
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof DangerZone>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DangerZone {...props} />);
  });
  return tree!;
}

describe("DangerZone", () => {
  it("renders the title and description", () => {
    const tree = render({
      title: "Veszélyzóna",
      description: "Sztornó és törlés",
      children: <RNText>content</RNText>,
    });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Veszélyzóna");
    expect(texts).toContain("Sztornó és törlés");
  });

  it("is collapsed by default (children not rendered)", () => {
    const tree = render({
      title: "Veszélyzóna",
      description: "d",
      children: <RNText testID="danger-children">content</RNText>,
    });
    expect(() => tree.root.findByProps({ testID: "danger-children" })).toThrow();
  });

  it("expands on toggle press to reveal children", () => {
    const tree = render({
      title: "Veszélyzóna",
      description: "d",
      children: <RNText testID="danger-children">content</RNText>,
    });
    const toggle = tree.root.findByProps({ testID: "danger-zone-toggle" });
    act(() => {
      toggle.props.onPress();
    });
    expect(tree.root.findByProps({ testID: "danger-children" })).toBeTruthy();
  });

  it("has a destructive border frame", () => {
    const tree = render({ title: "t", description: "d", children: <RNText>c</RNText> });
    const root = tree.root.findByProps({ testID: "danger-zone" });
    expect(root.props.className).toContain("border-destructive");
  });
});
