// components/navigation/MobileTabBar.test.tsx
// Phone tab bar: Főoldal, Számlák, Új (56x32 primary pill), Partnerek,
// Továbbiak, on the 1fr 1fr 1.45fr 1fr 1fr grid.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MobileTabBar, TAB_COLUMN_FLEX } from "@/components/navigation/MobileTabBar";
import { routes } from "@/lib/navigation";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", primary: "#00f", onNavyActive: "#fff" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
for (const m of ["box", "pressable", "text"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: Partial<React.ComponentProps<typeof MobileTabBar>> = {}) {
  const handlers = { onNavigate: jest.fn(), onOpenNew: jest.fn(), onOpenMore: jest.fn() };
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<MobileTabBar pathname="/dashboard" {...handlers} {...props} />);
  });
  const tab = (id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === "function")[0];
  return { tree, tab, ...handlers };
}

describe("MobileTabBar", () => {
  it("shows Főoldal, Számlák, Új, Partnerek, Továbbiak in that order", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    const order = ["nav.dashboard", "nav.invoices", "nav.newShort", "nav.partners", "nav.more"].map((k) => json.indexOf(k));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is a labelled navigation landmark with the safe-area padding", () => {
    const { tree } = render();
    const bar = tree.root.findByProps({ testID: "mobile-tab-bar" });
    expect(bar.props.role).toBe("navigation");
    expect(bar.props["aria-label"]).toBe("shell.tabs.label");
    expect(bar.props.style).toEqual({ paddingBottom: 26 });
    expect(bar.props.className).toContain("border-t");
    expect(bar.props.className).toContain("shadow-tabbar");
  });

  it("the grid is 1fr 1fr 1.45fr 1fr 1fr so the gaps between shapes are equal", () => {
    expect(TAB_COLUMN_FLEX).toEqual([1, 1, 1.45, 1, 1]);
    const { tree } = render();
    const columns = tree.root.findAll((n) => n.props?.style && "flexGrow" in (n.props.style as object) && "flexBasis" in (n.props.style as object));
    const grows = Array.from(new Set(columns.map((n) => (n.props.style as { flexGrow: number }).flexGrow)));
    expect(grows.sort()).toEqual([1, 1.45]);
    expect(columns.filter((n) => (n.props.style as { flexGrow: number }).flexGrow === 1.45).length).toBeGreaterThan(0);
  });

  it("Új is a 56x32 primary pill with a white plus", () => {
    const { tree, tab } = render();
    const pill = tree.root.findByProps({ testID: "tab-new-pill" });
    expect(pill.props.className).toContain("h-8 w-14");
    expect(pill.props.className).toContain("bg-primary");
    expect(pill.props.className).toContain("rounded-2xl");
    expect(tab("tab-new").props.accessibilityLabel).toBe("nav.newShort");
    expect(tree.root.findAllByProps({ testID: "icon-Plus" })[0].props.color).toBe("#fff");
  });

  it("Új and Továbbiak open their sheets; the other three navigate", () => {
    const { tab, onNavigate, onOpenNew, onOpenMore } = render();
    act(() => tab("tab-new").props.onPress());
    expect(onOpenNew).toHaveBeenCalledTimes(1);
    act(() => tab("tab-more").props.onPress());
    expect(onOpenMore).toHaveBeenCalledTimes(1);
    act(() => tab("tab-dashboard").props.onPress());
    act(() => tab("tab-invoices").props.onPress());
    act(() => tab("tab-partners").props.onPress());
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual([routes.dashboard, routes.invoices, routes.clients]);
    expect(onNavigate).toHaveBeenCalledTimes(3);
  });

  it("marks the current section active in primary and the rest muted", () => {
    const { tree, tab } = render({ pathname: "/invoices/abc" });
    expect(tab("tab-invoices").props.accessibilityState).toMatchObject({ selected: true });
    expect(tab("tab-invoices").props["aria-current"]).toBe("page");
    expect(tab("tab-dashboard").props.accessibilityState).toMatchObject({ selected: false });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("text-primary");
    expect(json).toContain("text-muted-ink");
  });

  it("reports an open sheet on Új / Továbbiak", () => {
    const { tab } = render({ newOpen: true, moreOpen: true });
    expect(tab("tab-new").props.accessibilityState).toMatchObject({ expanded: true });
    expect(tab("tab-more").props.accessibilityState).toMatchObject({ expanded: true });
  });

  it("every tab keeps a 52px touch height and 11px / 600 labels", () => {
    const { tree, tab } = render();
    for (const id of ["tab-dashboard", "tab-invoices", "tab-new", "tab-partners", "tab-more"]) {
      expect(tab(id).props.className).toContain("min-h-[52px]");
    }
    expect(JSON.stringify(tree.toJSON())).toContain("text-[11px] font-semibold");
  });
});
