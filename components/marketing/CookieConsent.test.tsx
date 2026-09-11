// components/marketing/CookieConsent.test.tsx
// Verifies persisted cookie choices stay closed and footer requests can reopen preferences.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  Pressable as mockRNPressable,
  Switch as mockRNSwitch,
  Text as mockRNText,
} from "react-native";
import { CookieConsent } from "@/components/marketing/CookieConsent";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => ({
  Button: mockRNPressable,
  ButtonText: mockRNText,
}));
jest.mock("@/components/ui/heading", () => ({ Heading: mockRNText }));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/switch", () => ({ Switch: mockRNSwitch }));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/cookie-consent", () => ({
  createCookieConsent: jest.fn((analytics, marketing) => ({
    essential: true,
    analytics,
    marketing,
  })),
  loadCookieConsent: jest.fn(() =>
    Promise.resolve({ essential: true, analytics: false, marketing: false }),
  ),
  saveCookieConsent: jest.fn(() => Promise.resolve()),
}));

describe("CookieConsent", () => {
  it("reopens persisted preferences when requested from the footer", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <CookieConsent reopenRequest={0} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(tree!.root.findAllByProps({ accessibilityRole: "alert" })).toHaveLength(0);

    await act(async () => {
      tree!.update(
        <CookieConsent reopenRequest={1} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(
      tree!.root.findAllByProps({ accessibilityRole: "alert" }).length,
    ).toBeGreaterThan(0);
  });
});
