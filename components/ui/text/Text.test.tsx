// components/ui/text/Text.test.tsx
// The `numeric` prop (spec §4.6): tabular-nums figures for money/quantity
// columns, on both the native (RN style) and web (className) paths.
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { Text } from "@/components/ui/text";
import { Text as TextWeb } from "@/components/ui/text/index.web";

function render(props: React.ComponentProps<typeof Text>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Text {...props} />);
  });
  return tree!;
}

function renderWeb(props: React.ComponentProps<typeof TextWeb>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<TextWeb {...props} />);
  });
  return tree!;
}

describe("Text numeric prop (native)", () => {
  it("applies a tabular-nums style when numeric", () => {
    const tree = render({ numeric: true, children: "450 000 Ft" });
    const host = tree.root.findByType(RNText);
    const style = Array.isArray(host.props.style) ? host.props.style : [host.props.style];
    expect(style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ["tabular-nums"] })])
    );
  });

  it("does not add a tabular-nums style when not numeric", () => {
    const tree = render({ children: "Tanácsadás" });
    const host = tree.root.findByType(RNText);
    expect(host.props.style).toBeFalsy();
  });
});

describe("Text numeric prop (web)", () => {
  it("adds the tabular-nums class when numeric", () => {
    const tree = renderWeb({ numeric: true, children: "450 000 Ft" });
    const host = tree.root.findByType("span" as unknown as React.ComponentType);
    expect(host.props.className).toContain("tabular-nums");
  });

  it("keeps the caller's className alongside tabular-nums", () => {
    const tree = renderWeb({ numeric: true, className: "font-semibold", children: "571 500 Ft" });
    const host = tree.root.findByType("span" as unknown as React.ComponentType);
    expect(host.props.className).toContain("tabular-nums");
    expect(host.props.className).toContain("font-semibold");
  });
});
