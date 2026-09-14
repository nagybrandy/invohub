// components/navigation/MobileAppHeader.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => {
    const { Text } = require("react-native");
    return <Text testID="mobile-language-switcher">LANG</Text>;
  },
}));
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    isDarkColorScheme: false,
    toggleTheme: jest.fn(),
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    primary: "#6495ed",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#8db600",
    accentForeground: "#1f305e",
    secondary: "#1f305e",
  }),
}));

describe("MobileAppHeader", () => {
  it("shows user name and company name", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Kovács Anna"
          companyName="TestCorp Kft."
          unreadCount={0}
          onOpenNotifications={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("TestCorp Kft.");
    expect(json).toContain("Kovács Anna");
    expect(json).toContain("TK");
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

  it("places the language switch after the notifications bell (right-most)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Test User"
          unreadCount={0}
          onOpenNotifications={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    const bellIndex = json.indexOf("Notifications");
    const switcherIndex = json.indexOf('"mobile-language-switcher"');
    expect(bellIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(bellIndex);
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
