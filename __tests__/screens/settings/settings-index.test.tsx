// __tests__/screens/settings/settings-index.test.tsx
// (Colocating this under app/(app)/settings/ would make Expo Router treat
// it as a conflicting route, so it lives under __tests__/ instead, same as
// the other app-screen tests in __tests__/screens/.)
// The phone start page: the grouped list of pages, a separate card with the
// logout row (opens the Kijelentkezel? confirm; Mégse never signs out), then
// the admin link and the dev-only demo seed. S1 fix: the "Demo adatok
// betöltése" button is an outline button after the logout row, at the bottom.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockRole = "entrepreneur";
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

const mockSignOut = jest.fn(async () => undefined);
jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "u1", name: "Teszt Elek", role: mockRole } } }),
  signOut: () => mockSignOut(),
}));

// The confirm dialog itself is covered by LogoutConfirm.test.tsx; here only the
// wiring (open / Mégse / Kijelentkezés) matters.
jest.mock("@/components/navigation/LogoutConfirm", () => {
  const actual = jest.requireActual("@/components/navigation/LogoutConfirm");
  const { Pressable } = require("react-native");
  return {
    useLogoutConfirm: actual.useLogoutConfirm,
    LogoutConfirm: ({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) =>
      open ? (
        <>
          <Pressable testID="logout-confirm-cancel" onPress={onCancel} />
          <Pressable testID="logout-confirm-confirm" onPress={onConfirm} />
        </>
      ) : null,
  };
});

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
    const signOutIndex = json.indexOf("settingsPages.logout.title");
    const demoIndex = json.indexOf("settings.demoData");
    expect(signOutIndex).toBeGreaterThan(-1);
    expect(demoIndex).toBeGreaterThan(signOutIndex);
    act(() => tree.unmount());
  });
});

describe("Settings start page", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSignOut.mockClear();
    mockRole = "entrepreneur";
  });

  async function render() {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<SettingsScreen />);
    });
    const all = (id: string) => tree.root.findAll((n) => n.props?.testID === id);
    return { tree, all };
  }

  it("lists every settings page with a title and a one-line description", async () => {
    const { tree, all } = await render();
    const json = JSON.stringify(tree.toJSON());
    for (const key of ["company", "billing", "pdf", "templates", "reminders", "nav", "access", "appearance", "apiKeys"]) {
      expect(all(`settings-start-${key}`).length).toBeGreaterThan(0);
      expect(json).toContain(`settingsPages.items.${key}.title`);
      expect(json).toContain(`settingsPages.items.${key}.description`);
    }
    expect(json).not.toContain("TaxAuditExport");
  });

  it("opens a page when its row is pressed", async () => {
    const { all } = await render();
    act(() => all("settings-start-nav")[0].props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/settings/nav");
  });

  it("puts the logout row in its own card after the list", async () => {
    const { tree, all } = await render();
    expect(all("settings-logout-card").length).toBeGreaterThan(0);
    const json = JSON.stringify(tree.toJSON());
    expect(json.indexOf("settingsPages.logout.description")).toBeGreaterThan(json.indexOf("settingsPages.items.apiKeys.title"));
  });

  it("Kijelentkezés asks first; Mégse closes the dialog without signing out", async () => {
    const { all } = await render();
    expect(all("logout-confirm-cancel")).toHaveLength(0);
    act(() => all("settings-logout")[0].props.onPress());
    expect(all("logout-confirm-cancel").length).toBeGreaterThan(0);
    act(() => all("logout-confirm-cancel")[0].props.onPress());
    expect(all("logout-confirm-cancel")).toHaveLength(0);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("confirming signs out and returns to the login page", async () => {
    const { all } = await render();
    act(() => all("settings-logout")[0].props.onPress());
    await act(async () => {
      all("logout-confirm-confirm")[0].props.onPress();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("filters the list by the search text and says so when nothing matches", async () => {
    const { all } = await render();
    act(() => all("settings-search")[0].props.onChangeText("api"));
    expect(all("settings-start-apiKeys").length).toBeGreaterThan(0);
    expect(all("settings-start-company")).toHaveLength(0);
    act(() => all("settings-search")[0].props.onChangeText("zzzz"));
    expect(all("settings-search-empty").length).toBeGreaterThan(0);
  });

  it("shows the admin link only to admins", async () => {
    expect((await render()).all("settings-admin")).toHaveLength(0);
    mockRole = "admin";
    expect((await render()).all("settings-admin").length).toBeGreaterThan(0);
  });
});
