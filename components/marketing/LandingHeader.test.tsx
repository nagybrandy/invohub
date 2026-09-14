// components/marketing/LandingHeader.test.tsx
// Verifies the language switch is the right-most control on desktop and mobile.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LandingHeader } from "@/components/marketing/LandingHeader";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/marketing/BrandLogo", () => ({
  BrandLogo: () => null,
}));
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: (props: { testID?: string }) => {
    const { Text } = require("react-native");
    return <Text testID={props.testID ?? "language-switcher"}>LANG</Text>;
  },
}));

function orderedTestIds(tree: TestRenderer.ReactTestRenderer, ids: string[]) {
  const json = JSON.stringify(tree.toJSON());
  return ids.map((id) => ({ id, index: json.indexOf(`"${id}"`) }));
}

const baseProps = {
  isSignedIn: false,
  onNavigate: jest.fn(),
  onLogin: jest.fn(),
  onPrimaryAction: jest.fn(),
  onOpenBlog: jest.fn(),
};

describe("LandingHeader", () => {
  it("places the language switch after login and the CTA on desktop", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LandingHeader {...baseProps} isDesktop />);
    });

    const positions = orderedTestIds(tree, [
      "landing-login",
      "landing-header-cta",
      "landing-language-switcher",
    ]);
    positions.forEach(({ id, index }) => expect(index).toBeGreaterThan(-1));
    expect(positions[2].index).toBeGreaterThan(positions[1].index);
    expect(positions[1].index).toBeGreaterThan(positions[0].index);

    // No burger toggle exists on desktop, so the switcher is the true right edge.
    expect(tree.root.findAllByProps({ testID: "landing-menu-toggle" })).toHaveLength(0);
    tree.unmount();
  });

  it("places the language switch immediately before the menu toggle on mobile", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LandingHeader {...baseProps} isDesktop={false} />);
    });

    const positions = orderedTestIds(tree, [
      "landing-header-cta",
      "landing-language-switcher",
      "landing-menu-toggle",
    ]);
    positions.forEach(({ id, index }) => expect(index).toBeGreaterThan(-1));
    expect(positions[1].index).toBeGreaterThan(positions[0].index);
    expect(positions[2].index).toBeGreaterThan(positions[1].index);
    tree.unmount();
  });
});
