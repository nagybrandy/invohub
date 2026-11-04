// components/navigation/MobileAppHeader.test.tsx
// Phone header: account button, search icon, bell; the search icon expands a
// full-width field with a close button.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ foreground: "#000" }) }));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "pressable"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/navigation/GlobalSearchField", () => ({
  GlobalSearchField: (props: { variant: string; autoFocus?: boolean; onClose?: () => void }) => {
    const { Pressable, Text } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="stub-search" onPress={props.onClose}>
        <Text>{`${props.variant}:${String(props.autoFocus)}`}</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/components/navigation/NotificationBell", () => ({
  NotificationBell: (props: { unreadCount: number; onPress: () => void }) => {
    const { Pressable, Text } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="stub-bell" onPress={props.onPress}>
        <Text>{String(props.unreadCount)}</Text>
      </Pressable>
    );
  },
}));

function render() {
  const onOpenNotifications = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <MobileAppHeader
        accountMenu={<></>}
        unreadCount={6}
        onOpenNotifications={onOpenNotifications}
      />,
    );
  });
  return { tree, onOpenNotifications };
}

describe("MobileAppHeader", () => {
  it("is a 56px surface bar with a line underneath", () => {
    const { tree } = render();
    const bar = tree.root.findByProps({ testID: "mobile-app-header" });
    expect(bar.props.className).toContain("h-14");
    expect(bar.props.className).toContain("bg-surface");
    expect(bar.props.className).toContain("border-b border-line");
  });

  it("shows the account menu slot, a search icon button and the bell with the real count", () => {
    const { tree } = render();
    expect(tree.root.findByProps({ testID: "mobile-search-button" }).props.accessibilityLabel).toBe("shell.search.open");
    expect(tree.root.findByProps({ testID: "stub-bell" })).toBeTruthy();
    expect(JSON.stringify(tree.toJSON())).toContain("6");
    expect(tree.root.findAllByProps({ testID: "stub-search" })).toHaveLength(0);
  });

  it("the search button is a 40x40 touch target", () => {
    const { tree } = render();
    expect(tree.root.findByProps({ testID: "mobile-search-button" }).props.className).toContain("h-10 w-10");
  });

  it("opens the notifications from the bell", () => {
    const { tree, onOpenNotifications } = render();
    act(() => tree.root.findByProps({ testID: "stub-bell" }).props.onPress());
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it("the search icon turns the bar into a full-width focused search field; closing brings the bar back", () => {
    const { tree } = render();
    act(() => tree.root.findByProps({ testID: "mobile-search-button" }).props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain("phone:true");
    expect(tree.root.findAllByProps({ testID: "mobile-search-button" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "stub-bell" })).toHaveLength(0);
    act(() => tree.root.findByProps({ testID: "stub-search" }).props.onPress());
    expect(tree.root.findByProps({ testID: "mobile-search-button" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "stub-bell" })).toBeTruthy();
  });

  it("has no logo, language switcher or theme toggle", () => {
    const json = JSON.stringify(render().tree.toJSON()).toLowerCase();
    for (const gone of ["language", "theme", "brandlogo"]) expect(json).not.toContain(gone);
  });
});
