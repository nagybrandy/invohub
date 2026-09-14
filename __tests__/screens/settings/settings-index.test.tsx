// __tests__/screens/settings/settings-index.test.tsx
// (Colocating this under app/(app)/settings/ would make Expo Router treat
// it as a conflicting route, so it lives under __tests__/ instead, same as
// the other app-screen tests in __tests__/screens/.)
// S1 fix: the "Demo adatok betöltése" button used to be the only full-width
// solid button on the settings hub, outranking sign-out. It's now an
// outline button placed after sign-out, at the bottom of the screen.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "u1", name: "Teszt Elek", role: "entrepreneur" } } }),
  signOut: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));

jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({ isDarkColorScheme: false, toggleTheme: jest.fn() }),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", accent: "#4f46e5" }),
}));

jest.mock("@/components/i18n/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: ({ variant, testID, children, onPress, disabled }: any) => {
    const { Pressable } = require("@/__tests__/mocks/gluestack-ui");
    return (
      <Pressable testID={testID} variant={variant ?? "default"} onPress={onPress} disabled={disabled}>
        {children}
      </Pressable>
    );
  },
  ButtonText: mockUi.Text,
  ButtonSpinner: mockUi.View,
}));

// Required lazily (not a top-level `import`, which Babel hoists above the
// `mockUi`/jest.mock setup above and would trip a TDZ error on `mockUi`).
const SettingsScreen = require("@/app/(app)/settings/index").default;

describe("Settings hub — demo data button (S1)", () => {
  const originalEnv = process.env.EXPO_PUBLIC_ALLOW_DEV_SEED;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ALLOW_DEV_SEED = "true";
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ALLOW_DEV_SEED = originalEnv;
  });

  it("renders the demo-data seed button as outline, not solid/primary", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<SettingsScreen />);
    });
    const [seedButton] = tree.root.findAllByProps({ testID: "settings-seed-demo-button" });
    expect(seedButton.props.variant).toBe("outline");
    act(() => tree.unmount());
  });

  it("places the demo-data card after the sign-out button", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<SettingsScreen />);
    });
    const json = JSON.stringify(tree.toJSON());
    const signOutIndex = json.indexOf("nav.signOut");
    const demoIndex = json.indexOf("settings.demoData");
    expect(signOutIndex).toBeGreaterThan(-1);
    expect(demoIndex).toBeGreaterThan(signOutIndex);
    act(() => tree.unmount());
  });
});
