// components/auth/AuthLayout.test.tsx
// The shared shell of login / forgot / reset / invite: a navy hero panel plus
// a 440px card from 900px up, a stacked logo + card layout below it.
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import {
  AUTH_SPLIT_MIN_WIDTH,
  AuthCardHeader,
  AuthLayout,
  AuthNote,
  resolveAuthVariant,
} from "@/components/auth/AuthLayout";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (href: unknown) => mockPush(href) } }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock("@/lib/useHydrated", () => ({ useHydrated: () => true }));
jest.mock("@/components/marketing/BrandLogo", () => ({
  BrandLogo: ({ tone }: { tone?: string }) => {
    const { Text: RNText } = require("react-native");
    return <RNText testID={`logo-${tone}`}>logo</RNText>;
  },
}));
jest.mock("@/components/marketing/BrandTexture", () => ({ BrandTexture: () => null }));
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => {
    const { Text: RNText } = require("react-native");
    return <RNText testID={`language-${tone}`}>lang</RNText>;
  },
}));

function render(width: number) {
  mockDims.width = width;
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <AuthLayout>
        <Text testID="card-content">form</Text>
      </AuthLayout>,
    );
  });
  return tree;
}

function has(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID }).length > 0;
}

function texts(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child) => typeof child === "string");
}

beforeEach(() => {
  mockPush.mockClear();
});

describe("resolveAuthVariant", () => {
  it("splits from the minimum width once hydrated, otherwise stacks", () => {
    expect(resolveAuthVariant(AUTH_SPLIT_MIN_WIDTH, true)).toBe("split");
    expect(resolveAuthVariant(1440, true)).toBe("split");
    expect(resolveAuthVariant(AUTH_SPLIT_MIN_WIDTH - 1, true)).toBe("stacked");
    expect(resolveAuthVariant(1440, false)).toBe("stacked");
  });
});

describe("AuthLayout at 1440", () => {
  it("shows the navy hero panel with title, subtitle, EV note, language dropdown and back link", () => {
    const tree = render(1440);
    expect(has(tree, "auth-hero-panel")).toBe(true);
    const all = texts(tree);
    expect(all).toContain("auth.heroTitle");
    expect(all).toContain("auth.heroSubtitle");
    expect(all).toContain("auth.evPriorityNote");
    expect(all).toContain("auth.backToHome");
    expect(has(tree, "language-onDark")).toBe(true);
    expect(has(tree, "logo-onDark")).toBe(true);
    expect(has(tree, "card-content")).toBe(true);
    expect(has(tree, "auth-card")).toBe(true);
  });

  it("goes home from the back link", () => {
    const tree = render(1440);
    const back = tree.root.findByProps({ testID: "auth-back-home" });
    act(() => back.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});

describe("AuthLayout at 375", () => {
  it("drops the navy panel and stacks logo + language, heading, card and back link", () => {
    const tree = render(375);
    expect(has(tree, "auth-hero-panel")).toBe(false);
    expect(has(tree, "auth-stacked-top")).toBe(true);
    expect(has(tree, "logo-onLight")).toBe(true);
    expect(has(tree, "language-onLight")).toBe(true);
    const all = texts(tree);
    expect(all).toContain("auth.heroTitle");
    expect(all).toContain("auth.heroSubtitle");
    expect(all).not.toContain("auth.evPriorityNote");
    expect(all).toContain("auth.backToHome");
    expect(has(tree, "card-content")).toBe(true);
    expect(has(tree, "auth-card")).toBe(true);
  });
});

describe("AuthCardHeader and AuthNote", () => {
  it("renders title and subtitle, and notes carry their tone", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <>
          <AuthCardHeader title="Cím" subtitle="Alcím" />
          <AuthNote tone="ok" testID="note-ok">
            Kész
          </AuthNote>
          <AuthNote tone="err" testID="note-err">
            Hiba
          </AuthNote>
        </>,
      );
    });
    expect(texts(tree)).toEqual(expect.arrayContaining(["Cím", "Alcím", "Kész", "Hiba"]));
    const styled = (id: string) =>
      tree.root.findAll((n) => n.props?.testID === id && typeof n.props?.className === "string")[0];
    expect(styled("note-ok").props.className).toContain("bg-ok-wash");
    expect(styled("note-err").props.className).toContain("bg-err-wash");
    expect(styled("note-err").props.accessibilityRole).toBe("alert");
  });
});
