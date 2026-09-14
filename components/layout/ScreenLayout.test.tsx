// components/layout/ScreenLayout.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { ScreenLayout } from "@/components/layout/ScreenLayout";

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof ScreenLayout>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ScreenLayout {...props} />);
  });
  return tree!;
}

describe("ScreenLayout", () => {
  it("keeps the old { children, header, scroll, scrollProps } shape working unchanged", () => {
    const tree = render({
      header: <RNText testID="header">Header</RNText>,
      children: <RNText testID="body">Body</RNText>,
    });
    expect(tree.root.findByProps({ testID: "header" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "body" })).toBeTruthy();
  });

  it("defaults to width=content: max-w-[1200px] mx-auto", () => {
    const tree = render({ children: <RNText>Body</RNText> });
    const content = tree.root.findByProps({ testID: "screen-layout-content" });
    expect(content.props.className).toContain("max-w-[1200px]");
    expect(content.props.className).toContain("mx-auto");
  });

  it("width=form caps at 720px", () => {
    const tree = render({ children: <RNText>Body</RNText>, width: "form" });
    const content = tree.root.findByProps({ testID: "screen-layout-content" });
    expect(content.props.className).toContain("max-w-[720px]");
  });

  it("width=full has no max width", () => {
    const tree = render({ children: <RNText>Body</RNText>, width: "full" });
    const content = tree.root.findByProps({ testID: "screen-layout-content" });
    expect(content.props.className).toContain("max-w-none");
    expect(content.props.className).not.toContain("max-w-[1200px]");
  });

  it("renders without scroll when scroll=false", () => {
    const tree = render({ children: <RNText testID="body">Body</RNText>, scroll: false });
    expect(tree.root.findByProps({ testID: "body" })).toBeTruthy();
  });
});
