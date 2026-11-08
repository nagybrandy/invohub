import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import { DeveloperDocsLink } from "@/components/settings/DeveloperDocsLink";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ primary: "#000" }) }));
jest.mock("lucide-react-native", () => ({ ExternalLink: () => null }));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("DeveloperDocsLink", () => {
  it("opens the public developer docs", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DeveloperDocsLink />);
    });
    const link = tree.root.findByProps({ testID: "api-keys-docs-link" });
    expect(link.props.accessibilityRole).toBe("link");
    act(() => {
      link.props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith("/developers");
    expect(JSON.stringify(tree.toJSON())).toContain("settingsPages.apiKeys.developerDocsLink");
  });
});
