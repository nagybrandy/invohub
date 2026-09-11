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
import {
  loadCookieConsent,
  saveCookieConsent,
} from "@/lib/cookie-consent";

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
    Promise.resolve({
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date(0).toISOString(),
    }),
  ),
  saveCookieConsent: jest.fn(() => Promise.resolve()),
}));

const loadCookieConsentMock = loadCookieConsent as jest.MockedFunction<
  typeof loadCookieConsent
>;
const saveCookieConsentMock = saveCookieConsent as jest.MockedFunction<
  typeof saveCookieConsent
>;

function nodesWithTestId(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
) {
  return tree.root.findAll(
    (node) => node.props.testID === testID && typeof node.type !== "string",
  );
}

describe("CookieConsent", () => {
  beforeEach(() => {
    loadCookieConsentMock.mockReset();
    saveCookieConsentMock.mockReset();
    loadCookieConsentMock.mockResolvedValue({
      essential: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date(0).toISOString(),
    });
    saveCookieConsentMock.mockResolvedValue(undefined);
  });

  it("stays closed when consent is already persisted", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <CookieConsent reopenRequest={0} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(nodesWithTestId(tree, "cookie-consent-dialog")).toHaveLength(0);
    tree.unmount();
  });

  it("reopens persisted preferences when requested from the footer", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <CookieConsent reopenRequest={0} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(nodesWithTestId(tree, "cookie-consent-dialog")).toHaveLength(0);

    await act(async () => {
      tree.update(
        <CookieConsent reopenRequest={1} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(
      tree.root.findAllByProps({ accessibilityRole: "alert" }).length,
    ).toBeGreaterThan(0);
    expect(nodesWithTestId(tree, "cookie-consent-dialog").length).toBeGreaterThan(0);
    tree.unmount();
  });

  it("dismisses the overlay after essential-only accept", async () => {
    loadCookieConsentMock.mockResolvedValueOnce(null);

    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <CookieConsent reopenRequest={0} onOpenPolicy={jest.fn()} />,
      );
      await Promise.resolve();
    });

    expect(nodesWithTestId(tree, "cookie-consent-dialog").length).toBeGreaterThan(0);

    await act(async () => {
      const essential = nodesWithTestId(tree, "cookie-consent-essential")[0];
      essential.props.onPress();
      await Promise.resolve();
    });

    expect(saveCookieConsentMock).toHaveBeenCalled();
    expect(nodesWithTestId(tree, "cookie-consent-dialog")).toHaveLength(0);
    tree.unmount();
  });
});
