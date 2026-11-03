// components/navigation/AppTopStrip.test.tsx
// The 56px desktop top bar holds the search field and the bell, nothing else.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppTopStrip } from "@/components/navigation/AppTopStrip";

jest.mock("@/components/navigation/GlobalSearchField", () => ({
  GlobalSearchField: (props: { variant: string }) => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return <Text testID="stub-search">{props.variant}</Text>;
  },
}));
jest.mock("@/components/navigation/NotificationBell", () => ({
  NotificationBell: (props: { unreadCount: number; onPress: () => void; expanded?: boolean }) => {
    const { Pressable, Text } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID="stub-bell" onPress={props.onPress}>
        <Text>{`${props.unreadCount}:${String(props.expanded)}`}</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: Partial<React.ComponentProps<typeof AppTopStrip>> = {}) {
  const onOpenNotifications = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<AppTopStrip unreadCount={6} onOpenNotifications={onOpenNotifications} {...props} />);
  });
  return { tree, onOpenNotifications };
}

describe("AppTopStrip", () => {
  it("is 56px high on the surface colour with a line underneath", () => {
    const { tree } = render();
    const bar = tree.root.findByProps({ testID: "app-topstrip" });
    expect(bar.props.className).toContain("h-14");
    expect(bar.props.className).toContain("bg-surface");
    expect(bar.props.className).toContain("border-b border-line");
  });

  it("contains the desktop search field and the bell with the real unread count", () => {
    const { tree } = render();
    expect(tree.root.findByProps({ testID: "stub-search" }).props.children).toBe("desktop");
    expect(JSON.stringify(tree.toJSON())).toContain("6:false");
  });

  it("opens the notifications from the bell", () => {
    const { tree, onOpenNotifications } = render();
    act(() => tree.root.findByProps({ testID: "stub-bell" }).props.onPress());
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it("has no page title, breadcrumb, language, theme toggle or avatar", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    for (const gone of ["breadcrumb", "language", "theme", "avatar", "collapse", "user-menu", "account-switcher"]) {
      expect(json.toLowerCase()).not.toContain(gone);
    }
    // exactly two children: search + bell
    const bar = tree.root.findByProps({ testID: "app-topstrip" });
    const kids = (tree.toJSON() as { children: unknown[] }).children;
    expect(kids).toHaveLength(2);
    expect(bar).toBeTruthy();
  });

  it("passes the open state to the bell", () => {
    expect(JSON.stringify(render({ notificationsOpen: true }).tree.toJSON())).toContain("6:true");
  });
});
