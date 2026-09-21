// components/navigation/MobileAppHeader.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { MobileAppHeader } from "@/components/navigation/MobileAppHeader";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
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
  it("shows user name and company name, with the monogram from the USER's name (M3)", () => {
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
    // Monogram is the USER's initials ("KA"), never the company's ("TK") — M3.
    expect(json).toContain("KA");
    expect(json).not.toContain('"TK"');
  });

  it("derives the monogram from the user even with a different company name", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader
          userName="Teszt Elek"
          companyName="InvoHub Demo"
          unreadCount={0}
          onOpenNotifications={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('"TE"');
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
    const bellIndex = json.indexOf("nav.notifications");
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
    const bell = pressables.find((node) => node.props.accessibilityLabel === "nav.notificationsUnread");
    act(() => {
      bell?.props.onPress();
    });
    expect(onOpenNotifications).toHaveBeenCalled();
  });

  function bellWrapper(tree: TestRenderer.ReactTestRenderer) {
    return tree.root.findAll(
      (n) => typeof n.props?.onPress === "function" && typeof n.props?.className === "string"
    )[0];
  }

  it("sizes the bell wrapper to a 44x44 tap target (AC9)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={0} onOpenNotifications={jest.fn()} />
      );
    });
    const bell = bellWrapper(tree!);
    expect(String(bell.props.className)).toContain("h-11");
    expect(String(bell.props.className)).toContain("w-11");
    expect(String(bell.props.className)).toContain("items-center");
    expect(String(bell.props.className)).toContain("justify-center");
    expect(bell.props.hitSlop).toEqual({ top: 8, right: 0, bottom: 8, left: 8 });
  });

  it("trims the bell's right hitSlop to 0 because it faces the language switcher", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={0} onOpenNotifications={jest.fn()} />
      );
    });
    const bell = bellWrapper(tree!);
    expect(bell.props.hitSlop.right).toBe(0);
    expect(bell.props.hitSlop.top).toBe(8);
    expect(bell.props.hitSlop.bottom).toBe(8);
    expect(bell.props.hitSlop.left).toBe(8);
  });

  it("shows no badge for unreadCount 0", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={0} onOpenNotifications={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).not.toMatch(/"9\+"/);
  });

  it("shows the exact count badge for unreadCount 3", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={3} onOpenNotifications={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('"3"');
  });

  it("caps the badge at '9+' for unreadCount 12", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={12} onOpenNotifications={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("9+");
  });

  it("uses nav.notifications as the accessibilityLabel when nothing is unread (AC10)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={0} onOpenNotifications={jest.fn()} />
      );
    });
    const bell = bellWrapper(tree!);
    expect(bell.props.accessibilityLabel).toBe("nav.notifications");
  });

  it("uses nav.notificationsUnread as the accessibilityLabel when unreadCount > 0 (AC10)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <MobileAppHeader userName="Test User" unreadCount={5} onOpenNotifications={jest.fn()} />
      );
    });
    const bell = bellWrapper(tree!);
    expect(bell.props.accessibilityLabel).toBe("nav.notificationsUnread");
  });
});
