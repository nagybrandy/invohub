// components/marketing/LandingHeader.test.tsx
// Responsive variants of the landing header (SPEC §10.4): links + both
// actions + language dropdown on desktop; logo + a menu button that opens a
// bottom sheet with the four links and both actions on phones.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LandingHeader } from "@/components/marketing/LandingHeader";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#212325", onNavyActive: "#ffffff", muted: "#5b5d61" }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/sheet", () => {
  const { View, Pressable } = require("react-native");
  return {
    Sheet: ({
      open,
      onClose,
      children,
      testID,
    }: {
      open: boolean;
      onClose: () => void;
      children?: React.ReactNode;
      testID?: string;
    }) =>
      open ? (
        <View testID={testID}>
          <Pressable testID={`${testID}-close`} onPress={onClose} />
          {children}
        </View>
      ) : null,
  };
});
jest.mock("@/components/marketing/BrandLogo", () => ({
  BrandLogo: ({ tone }: { tone?: string }) => {
    const { Text } = require("react-native");
    return <Text testID={`logo-${tone}`}>logo</Text>;
  },
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

async function render(props: Partial<React.ComponentProps<typeof LandingHeader>> & { isDesktop: boolean }) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(() => {
    tree = TestRenderer.create(<LandingHeader {...baseProps} {...props} />);
  });
  return tree;
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === "function")[0];
  return act(() => node.props.onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("LandingHeader (desktop)", () => {
  it("places the language switch after login and the CTA, with no menu button", async () => {
    const tree = await render({ isDesktop: true });
    const positions = orderedTestIds(tree, [
      "landing-login",
      "landing-header-cta",
      "landing-language-switcher",
    ]);
    positions.forEach(({ index }) => expect(index).toBeGreaterThan(-1));
    expect(positions[2].index).toBeGreaterThan(positions[1].index);
    expect(positions[1].index).toBeGreaterThan(positions[0].index);
    expect(hasTestId(tree, "landing-menu-toggle")).toBe(false);
    tree.unmount();
  });

  it("shows the four links and the dashboard CTA (no login) when signed in", async () => {
    const tree = await render({ isDesktop: true, isSignedIn: true });
    const json = JSON.stringify(tree.toJSON());
    for (const key of [
      "landing.nav.product",
      "landing.nav.capabilities",
      "landing.nav.workflow",
      "landing.nav.blog",
      "landing.goToDashboard",
    ]) {
      expect(json).toContain(key);
    }
    expect(hasTestId(tree, "landing-login")).toBe(false);
    tree.unmount();
  });

  it("scrolls to the sections and opens the blog from the links", async () => {
    const tree = await render({ isDesktop: true });
    const links = tree.root.findAll(
      (n) => n.props?.accessibilityRole === "link" && typeof n.props?.onPress === "function",
    );
    expect(links.length).toBeGreaterThanOrEqual(5);
    await press(tree, "landing-nav-blog");
    expect(baseProps.onOpenBlog).toHaveBeenCalledTimes(1);
    await press(tree, "landing-header-cta");
    expect(baseProps.onPrimaryAction).toHaveBeenCalledTimes(1);
    await press(tree, "landing-login");
    expect(baseProps.onLogin).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it("is a transparent overlay over the hero, and an in-flow solid bar when forced solid", async () => {
    const overlay = await render({ isDesktop: true });
    const overlayHeader = overlay.root.findAll((n) => n.props?.testID === "landing-header")[0];
    expect(overlayHeader.props.className).toContain("web:fixed");
    expect(JSON.stringify(overlay.toJSON())).toContain("logo-onDark");
    overlay.unmount();

    const solid = await render({ isDesktop: true, forceSolid: true });
    const solidHeader = solid.root.findAll((n) => n.props?.testID === "landing-header")[0];
    expect(solidHeader.props.className).not.toContain("web:fixed");
    expect(solidHeader.props.className).toContain("bg-surface");
    expect(JSON.stringify(solid.toJSON())).toContain("logo-onLight");
    solid.unmount();
  });
});

describe("LandingHeader (phone)", () => {
  it("keeps the bar down to logo + menu button; the sheet carries links, both actions and the language switch", async () => {
    const tree = await render({ isDesktop: false });

    expect(hasTestId(tree, "landing-header-cta")).toBe(false);
    expect(hasTestId(tree, "landing-language-switcher")).toBe(false);
    expect(hasTestId(tree, "landing-login")).toBe(false);
    expect(hasTestId(tree, "landing-menu-toggle")).toBe(true);
    expect(hasTestId(tree, "landing-mobile-menu")).toBe(false);

    await press(tree, "landing-menu-toggle");

    expect(hasTestId(tree, "landing-mobile-menu")).toBe(true);
    const json = JSON.stringify(tree.toJSON());
    for (const key of [
      "landing.nav.product",
      "landing.nav.capabilities",
      "landing.nav.workflow",
      "landing.nav.blog",
    ]) {
      expect(json).toContain(key);
    }
    expect(hasTestId(tree, "landing-mobile-login")).toBe(true);
    expect(hasTestId(tree, "landing-mobile-cta")).toBe(true);
    expect(hasTestId(tree, "landing-mobile-language-switcher")).toBe(true);
    tree.unmount();
  });

  it("closes the sheet on its close action and after choosing a link or an action", async () => {
    const tree = await render({ isDesktop: false });

    await press(tree, "landing-menu-toggle");
    await press(tree, "landing-mobile-menu-close");
    expect(hasTestId(tree, "landing-mobile-menu")).toBe(false);

    await press(tree, "landing-menu-toggle");
    await press(tree, "landing-mobile-blog");
    expect(baseProps.onOpenBlog).toHaveBeenCalledTimes(1);
    expect(hasTestId(tree, "landing-mobile-menu")).toBe(false);

    await press(tree, "landing-menu-toggle");
    await press(tree, "landing-mobile-cta");
    expect(baseProps.onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(hasTestId(tree, "landing-mobile-menu")).toBe(false);

    await press(tree, "landing-menu-toggle");
    await press(tree, "landing-mobile-login");
    expect(baseProps.onLogin).toHaveBeenCalledTimes(1);
    tree.unmount();
  });

  it("navigates to a section from the sheet and closes it", async () => {
    const tree = await render({ isDesktop: false });
    await press(tree, "landing-menu-toggle");
    await press(tree, "landing-mobile-link-workflow");
    expect(baseProps.onNavigate).toHaveBeenCalledWith("workflow");
    expect(hasTestId(tree, "landing-mobile-menu")).toBe(false);
    tree.unmount();
  });

  it("offers only the dashboard action in the sheet when signed in", async () => {
    const tree = await render({ isDesktop: false, isSignedIn: true });
    await press(tree, "landing-menu-toggle");
    expect(hasTestId(tree, "landing-mobile-login")).toBe(false);
    expect(hasTestId(tree, "landing-mobile-cta")).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("landing.goToDashboard");
    tree.unmount();
  });
});
