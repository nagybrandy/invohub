// components/layout/StateView.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { StateView } from "@/components/layout/StateView";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof StateView>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<StateView {...props} />);
  });
  return tree!;
}

describe("StateView", () => {
  it("kind=loading renders a skeleton, not a spinner", () => {
    const tree = render({ kind: "loading" });
    expect(tree.root.findByProps({ testID: "state-view-skeleton" })).toBeTruthy();
    expect(() => tree.root.findByType(require("react-native").ActivityIndicator)).toThrow();
  });

  it("kind=loading renders the requested number of skeleton rows", () => {
    const tree = render({ kind: "loading", skeletonRows: 3 });
    const skeleton = tree.root.findByProps({ testID: "state-view-skeleton" });
    expect(skeleton.props.children).toHaveLength(3);
  });

  it("kind=empty renders a title, description and action", () => {
    const tree = render({
      kind: "empty",
      title: "Még nincs számlád",
      description: "Hozz létre egy NAV-kész számlát.",
      action: <RNText testID="empty-action">Új számla</RNText>,
    });
    expect(tree.root.findByProps({ testID: "state-view-empty" })).toBeTruthy();
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Még nincs számlád");
    expect(texts).toContain("Hozz létre egy NAV-kész számlát.");
    expect(tree.root.findByProps({ testID: "empty-action" })).toBeTruthy();
  });

  it("kind=empty falls back to the i18n default title", () => {
    const tree = render({ kind: "empty" });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("states.emptyTitle");
  });

  it("kind=error renders an onRetry button", () => {
    const onRetry = jest.fn();
    const tree = render({ kind: "error", onRetry });
    const retry = tree.root.findByProps({ testID: "state-view-retry" });
    act(() => {
      retry.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("kind=error falls back to i18n default title/description", () => {
    const tree = render({ kind: "error", onRetry: jest.fn() });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("states.errorTitle");
    expect(texts).toContain("states.errorDescription");
  });
});
