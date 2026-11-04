// components/navigation/GlobalSearchField.test.tsx
// The global search input: "Keresés" placeholder, no keyboard-hint badge, owns
// the query, hands it to GlobalSearchResults, Esc clears; phone has a close button.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({ "shell.search.placeholder": "Keresés", "shell.search.close": "Keresés bezárása" })[key] ?? key,
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ muted: "#666" }) }));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "pressable"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

const resultsProps: { current: { query: string; onClose: () => void; variant?: string } | null } = { current: null };
jest.mock("@/components/search/GlobalSearchResults", () => ({
  GlobalSearchResults: (props: { query: string; onClose: () => void; variant?: string }) => {
    resultsProps.current = props;
    return null;
  },
}));

import { GlobalSearchField } from "@/components/navigation/GlobalSearchField";

function render(props: Partial<React.ComponentProps<typeof GlobalSearchField>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<GlobalSearchField variant="desktop" {...props} />);
  });
  return tree;
}
const input = (tree: TestRenderer.ReactTestRenderer) => tree.root.findByProps({ testID: "global-search" });

describe("GlobalSearchField", () => {
  it("is a labelled search field with the Keresés placeholder and no keyboard hint", () => {
    const tree = render();
    expect(input(tree).props.placeholder).toBe("Keresés");
    expect(input(tree).props.role).toBe("searchbox");
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/⌘|Ctrl|kbd|\/<|"K"/);
  });

  it("desktop: 36px high, 340px wide; phone: 40px and full width", () => {
    const desktop = render();
    expect(desktop.root.findByProps({ testID: "global-search-root" }).props.className).toContain("w-[340px]");
    expect(JSON.stringify(desktop.toJSON())).toContain("h-9");
    const phone = render({ variant: "phone" });
    expect(phone.root.findByProps({ testID: "global-search-root" }).props.className).toContain("flex-1");
    expect(JSON.stringify(phone.toJSON())).toContain("h-10");
  });

  it("owns the query and passes it to the results component", () => {
    const tree = render();
    expect(resultsProps.current?.query).toBe("");
    act(() => input(tree).props.onChangeText("nordic"));
    expect(resultsProps.current?.query).toBe("nordic");
    expect(resultsProps.current?.variant).toBe("popover");
  });

  it("Escape clears the field and closes", () => {
    const onClose = jest.fn();
    const tree = render({ onClose });
    act(() => input(tree).props.onChangeText("nordic"));
    act(() => input(tree).props.onKeyPress({ nativeEvent: { key: "Escape" } }));
    expect(resultsProps.current?.query).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("other keys do nothing", () => {
    const onClose = jest.fn();
    const tree = render({ onClose });
    act(() => input(tree).props.onChangeText("nordic"));
    act(() => input(tree).props.onKeyPress({ nativeEvent: { key: "a" } }));
    expect(resultsProps.current?.query).toBe("nordic");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("the results can close and clear the field themselves", () => {
    const tree = render();
    act(() => input(tree).props.onChangeText("nordic"));
    act(() => resultsProps.current!.onClose());
    expect(resultsProps.current?.query).toBe("");
  });

  it("phone: a close button collapses the search, and results render as a panel", () => {
    const onClose = jest.fn();
    const tree = render({ variant: "phone", onClose });
    expect(resultsProps.current?.variant).toBe("panel");
    const close = tree.root.findByProps({ testID: "global-search-close" });
    expect(close.props.accessibilityLabel).toBe("Keresés bezárása");
    act(() => close.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("desktop has no close button; the field focuses itself on request", () => {
    expect(render().root.findAllByProps({ testID: "global-search-close" })).toHaveLength(0);
    expect(input(render({ variant: "phone", autoFocus: true })).props.autoFocus).toBe(true);
  });
});
