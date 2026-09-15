// components/layout/Section.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText, View } from "react-native";
import { Section } from "@/components/layout/Section";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof Section>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Section {...props} />);
  });
  return tree!;
}

describe("Section", () => {
  it("renders title, description and children", () => {
    const tree = render({
      title: "Tételek",
      description: "A számla sorai",
      children: <RNText>content</RNText>,
    });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Tételek");
    expect(texts).toContain("A számla sorai");
    expect(texts).toContain("content");
  });

  it("renders the action slot", () => {
    const tree = render({
      title: "Tételek",
      action: <RNText testID="edit-action">Edit</RNText>,
      children: <RNText>content</RNText>,
    });
    expect(tree.root.findByProps({ testID: "edit-action" })).toBeTruthy();
  });

  it("card variant gets a rounded-xl subtle-border frame with no shadow", () => {
    const tree = render({ title: "X", children: <RNText>c</RNText> });
    const root = tree.root.findByProps({ testID: "section" });
    expect(root.props.className).toContain("rounded-xl");
    expect(root.props.className).toContain("border-subtle");
    expect(root.props.className).not.toMatch(/shadow/);
  });

  it("plain variant renders no frame classes", () => {
    const tree = render({ variant: "plain", children: <RNText>c</RNText> });
    const root = tree.root.findByProps({ testID: "section" });
    expect(root.props.className).not.toContain("rounded-xl");
    expect(root.props.className).not.toContain("border");
  });

  it("renders without a header row when no title/description/action given", () => {
    const tree = render({ children: <RNText>only content</RNText> });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toEqual(["only content"]);
  });

  it("merges a custom className", () => {
    const tree = render({ className: "mt-6", children: <RNText>c</RNText> });
    const root = tree.root.findByProps({ testID: "section" });
    expect(root.props.className).toContain("mt-6");
  });
});
