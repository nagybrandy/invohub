// components/layout/ListScreen.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";
import { ListScreen } from "@/components/layout/ListScreen";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

type Item = { id: string; name: string };

function render(props: Partial<React.ComponentProps<typeof ListScreen<Item>>>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ListScreen<Item>
        data={[]}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <RNText>{item.name}</RNText>}
        {...props}
      />
    );
  });
  return tree!;
}

describe("ListScreen", () => {
  it("has no hardcoded English empty title — uses the i18n default", () => {
    const tree = render({});
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("states.emptyTitle");
    expect(texts).not.toContain("Nothing here yet");
  });

  it("honors an explicit emptyTitle override", () => {
    const tree = render({ emptyTitle: "Még nincs számlád" });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Még nincs számlád");
  });

  it("loading renders a skeleton, not an ActivityIndicator", () => {
    const tree = render({ loading: true });
    expect(() =>
      tree.root.findByType(require("react-native").ActivityIndicator)
    ).toThrow();
  });

  it("renders items when data is non-empty", () => {
    const tree = render({ data: [{ id: "1", name: "Tech Solutions" }] });
    const texts = tree.root.findAllByType(RNText).map((n) => n.props.children);
    expect(texts).toContain("Tech Solutions");
  });
});
