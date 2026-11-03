// components/navigation/NotificationBell.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { NotificationBell } from "@/components/navigation/NotificationBell";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: { count?: number }) => (o ? `${key}:${o.count}` : key) }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ foreground: "#000" }) }));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "pressable", "text"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: Partial<React.ComponentProps<typeof NotificationBell>> = {}) {
  const onPress = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotificationBell unreadCount={0} onPress={onPress} {...props} />);
  });
  return { tree, onPress };
}

describe("NotificationBell", () => {
  it("hides the badge at 0 and labels the button plainly", () => {
    const { tree } = render();
    expect(tree.root.findAllByProps({ testID: "notification-bell-badge" })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: "notification-bell" }).props.accessibilityLabel).toBe("nav.notifications");
  });

  it("shows the real unread count in a red badge and says so in the label", () => {
    const { tree } = render({ unreadCount: 6 });
    const badge = tree.root.findByProps({ testID: "notification-bell-badge" });
    expect(badge.props.className).toContain("bg-err");
    expect(JSON.stringify(tree.toJSON())).toContain("6");
    expect(tree.root.findByProps({ testID: "notification-bell" }).props.accessibilityLabel).toBe("nav.notificationsUnread:6");
  });

  it("caps very large counts", () => {
    expect(JSON.stringify(render({ unreadCount: 250 }).tree.toJSON())).toContain("99+");
  });

  it("is a 34x34 button (40 on phones) that reports pressed and expanded", () => {
    const { tree, onPress } = render({ expanded: true });
    const bell = tree.root.findByProps({ testID: "notification-bell" });
    expect(bell.props.className).toContain("h-[34px] w-[34px]");
    expect(bell.props.className).toContain("phone:h-10 phone:w-10");
    expect(bell.props.accessibilityState).toMatchObject({ expanded: true });
    act(() => bell.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
