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

// react-test-renderer's findAllByProps matches every fiber that carries a
// prop (composite + host instances through forwardRef/memo layers in the
// gluestack mocks), so a single logical element can show up more than once.
// Presence/absence is robust via a substring search on the serialized tree;
// exact counts are not.
function hasTestId(tree: TestRenderer.ReactTestRenderer, id: string) {
  return JSON.stringify(tree.toJSON()).includes(`"${id}"`);
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

  it("keeps the mobile top bar down to just brand + hamburger, with the CTA and language switch inside the fullscreen menu instead", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LandingHeader {...baseProps} isDesktop={false} />);
    });

    // Closed: no CTA, no language switch, no login button up top — only the
    // brand mark and the hamburger toggle.
    expect(hasTestId(tree, "landing-header-cta")).toBe(false);
    expect(hasTestId(tree, "landing-language-switcher")).toBe(false);
    expect(hasTestId(tree, "landing-login")).toBe(false);
    expect(hasTestId(tree, "landing-menu-toggle")).toBe(true);

    // Opened: the fullscreen menu carries the CTA and the language switch.
    await act(() => {
      tree.root.findAllByProps({ testID: "landing-menu-toggle" })[0].props.onPress();
    });
    expect(hasTestId(tree, "landing-mobile-cta")).toBe(true);
    expect(hasTestId(tree, "landing-mobile-language-switcher")).toBe(true);

    tree.unmount();
  });
});
