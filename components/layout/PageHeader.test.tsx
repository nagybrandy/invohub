// components/layout/PageHeader.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { PageHeader } from "@/components/layout/PageHeader";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));

function render(props: React.ComponentProps<typeof PageHeader>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<PageHeader {...props} />);
  });
  return tree!;
}

describe("PageHeader", () => {
  it("keeps the old { title, subtitle, actions } shape working unchanged", () => {
    const tree = render({
      title: "Számlák",
      subtitle: "12 számla",
      actions: <RNText testID="old-action">Új</RNText>,
    });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Számlák");
    expect(texts).toContain("12 számla");
    expect(tree.root.findByProps({ testID: "old-action" })).toBeTruthy();
  });

  it("renders title only when nothing else is given", () => {
    const tree = render({ title: "Vezérlőpult" });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toEqual(["Vezérlőpult"]);
  });

  it("renders a breadcrumb when provided", () => {
    const tree = render({
      title: "INV-2026-010",
      breadcrumb: [{ label: "Számlák", href: "/invoices" as any }, { label: "INV-2026-010" }],
    });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Számlák");
  });

  it("omits the breadcrumb row when the array is empty", () => {
    const tree = render({ title: "Vezérlőpult", breadcrumb: [] });
    // no Pressable (breadcrumb link) should render
    expect(() => tree.root.findAllByType(RNText)).not.toThrow();
  });

  it("renders meta content inline with the title", () => {
    const tree = render({
      title: "INV-2026-010",
      meta: <RNText testID="status-chip">Fizetve</RNText>,
    });
    expect(tree.root.findByProps({ testID: "status-chip" })).toBeTruthy();
  });

  it("renders primaryAction, secondaryActions and overflowActions together", () => {
    const tree = render({
      title: "Számlák",
      primaryAction: <RNText testID="primary">Új számla</RNText>,
      secondaryActions: <RNText testID="secondary">Export</RNText>,
      overflowActions: [{ label: "Egyéb", onPress: jest.fn() }],
    });
    expect(tree.root.findByProps({ testID: "primary" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "secondary" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "overflow-menu-trigger" })).toBeTruthy();
  });

  it("omits the overflow menu when overflowActions is empty", () => {
    const tree = render({ title: "Számlák", overflowActions: [] });
    expect(() => tree.root.findByProps({ testID: "overflow-menu-trigger" })).toThrow();
  });

  it("uses the display type scale for the title (32/38 bold heading font)", () => {
    const tree = render({ title: "Vezérlőpult" });
    const heading = tree.root.findByProps({ children: "Vezérlőpult" });
    expect(heading.props.className).toContain("text-[32px]");
    expect(heading.props.className).toContain("leading-[38px]");
    expect(heading.props.className).toContain("font-heading");
  });

  it("labels the overflow trigger 'Továbbiak' when overflowLabel is omitted", () => {
    const tree = render({
      title: "Vezérlőpult",
      overflowActions: [{ label: "Egyéb", onPress: jest.fn() }],
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    expect(trigger.props.accessibilityLabel).toBe("Továbbiak");
  });

  it("labels the overflow trigger with overflowLabel when given", () => {
    const tree = render({
      title: "Vezérlőpult",
      overflowActions: [{ label: "Egyéb", onPress: jest.fn() }],
      overflowLabel: "More",
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    expect(trigger.props.accessibilityLabel).toBe("More");
  });
});
