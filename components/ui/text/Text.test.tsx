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
    const style = (Array.isArray(host.props.style) ? host.props.style : [host.props.style]).filter(Boolean);
    expect(style).not.toEqual(expect.arrayContaining([expect.objectContaining({ fontVariant: expect.anything() })]));
  });

  it("selects the static Stack Sans cut from the weight class (native only)", () => {
    const flat = (tree: TestRenderer.ReactTestRenderer) =>
      Object.assign({}, ...[tree.root.findByType(RNText).props.style].flat(2).filter(Boolean));
    expect(flat(render({ children: "a" }))).toMatchObject({ fontFamily: "StackSansText_400Regular", fontWeight: "normal" });
    expect(flat(render({ className: "font-semibold", children: "a" }))).toMatchObject({
      fontFamily: "StackSansText_600SemiBold",
    });
    expect(flat(render({ bold: true, children: "a" }))).toMatchObject({ fontFamily: "StackSansText_700Bold" });
    expect(flat(render({ className: "font-heading font-bold", children: "a" }))).toMatchObject({
      fontFamily: "StackSansNotch_700Bold",
    });
  });
});

describe("Text numeric prop (web)", () => {
  it("adds the tabular-nums class when numeric", () => {
    const tree = renderWeb({ numeric: true, children: "450 000 Ft" });
    const host = tree.root.findByType("span" as unknown as React.ComponentType);
    expect(host.props.className).toContain("tabular-nums");
  });

  it("turns numberOfLines into truncation classes instead of a DOM attribute", () => {
    const one = renderWeb({ numberOfLines: 1, children: "Nagyon hosszú cégnév Kft." });
    const host = one.root.findByType("span" as unknown as React.ComponentType);
    expect(host.props.className).toContain("truncate");
    expect(host.props.numberOfLines).toBeUndefined();
    const two = renderWeb({ numberOfLines: 2, children: "x" });
    expect(two.root.findByType("span" as unknown as React.ComponentType).props.className).toContain("line-clamp-2");
    const none = renderWeb({ children: "x" });
    expect(none.root.findByType("span" as unknown as React.ComponentType).props.className).not.toContain("truncate");
  });

  it("keeps the caller's className alongside tabular-nums", () => {
    const tree = renderWeb({ numeric: true, className: "font-semibold", children: "571 500 Ft" });
    const host = tree.root.findByType("span" as unknown as React.ComponentType);
    expect(host.props.className).toContain("tabular-nums");
    expect(host.props.className).toContain("font-semibold");
  });
});
