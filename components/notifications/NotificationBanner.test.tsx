// components/notifications/NotificationBanner.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const notification = {
  id: "n1",
  userId: "u1",
  type: "overdue_invoice" as const,
  title: "Overdue: INV-001",
  read: false,
  createdAt: "2026-07-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
};

describe("NotificationBanner", () => {
  it("renders title and extra count", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner
          notification={notification}
          unreadCount={3}
          onPress={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Overdue: INV-001");
    expect(json).toContain("+2 more");
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NotificationBanner
          notification={notification}
          unreadCount={1}
          onPress={onPress}
        />
      );
    });
    const pressable = tree!.root.find(
      (node) => typeof node.props?.onPress === "function"
    );
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalled();
  });
});
