// components/navigation/MobileAppHeader.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    isDarkColorScheme: false,
    toggleTheme: jest.fn(),
  }),
}));

describe("MobileAppHeader", () => {
  it("shows user name and role", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Kovács Anna"
          userRole="accountant"
          unreadCount={0}
          onOpenNotifications={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Kovács Anna");
    expect(json).toContain("Accountant");
    expect(json).toContain("KA");
  });

  it("shows unread badge when count > 0", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Test User"
          unreadCount={5}
          onOpenNotifications={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("5");
  });

  it("opens notifications on bell press", () => {
    const onOpenNotifications = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Test User"
          unreadCount={1}
          onOpenNotifications={onOpenNotifications}
        />
      );
    });
    const pressables = tree!.root.findAll(
      (node) => typeof node.props?.onPress === "function"
    );
    const bell = pressables.find((node) => node.props.accessibilityLabel === "Notifications");
    act(() => {
      bell?.props.onPress();
    });
    expect(onOpenNotifications).toHaveBeenCalled();
  });
});
