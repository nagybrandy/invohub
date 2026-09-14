// components/navigation/DesktopTopBar.test.tsx
// Verifies the language switch is the right-most control in the desktop top bar.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { DesktopTopBar } from "@/components/navigation/DesktopTopBar";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
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
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => {
    const { Text } = require("react-native");
    return <Text testID="desktop-language-switcher">LANG</Text>;
  },
}));

describe("DesktopTopBar", () => {
  it("renders the language switch after the new-invoice, bell, and avatar controls", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <DesktopTopBar
          companyName="TestCorp Kft."
          navItems={[]}
          activeHref="/dashboard"
          unreadCount={2}
          userName="Kovács Anna"
          onNavigate={jest.fn()}
          onNewInvoice={jest.fn()}
          onOpenNotifications={jest.fn()}
        />,
      );
    });

    const json = JSON.stringify(tree.toJSON());
    const newInvoiceIndex = json.indexOf("nav.newInvoice");
    const avatarIndex = json.indexOf('"KA"');
    const switcherIndex = json.indexOf('"desktop-language-switcher"');

    expect(newInvoiceIndex).toBeGreaterThan(-1);
    expect(avatarIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(avatarIndex);
    expect(avatarIndex).toBeGreaterThan(newInvoiceIndex);
    tree.unmount();
  });
});
