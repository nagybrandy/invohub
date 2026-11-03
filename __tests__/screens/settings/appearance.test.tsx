// __tests__/screens/settings/appearance.test.tsx
// Nyelv és megjelenés: the language dropdown and the three theme cards. The
// cards write light / dark / system through useColorScheme().setTheme.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockSetTheme = jest.fn(async () => undefined);
let mockPreference: "light" | "dark" | "system" = "system";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({ preference: mockPreference, setTheme: mockSetTheme }),
}));
jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: ({ testID }: { testID?: string }) => {
    const { View } = require("react-native");
    return <View testID={testID} />;
  },
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "heading", "pressable", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}

import AppearanceSettingsScreen from "@/app/(app)/settings/appearance";

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<AppearanceSettingsScreen />);
  });
  const all = (id: string) => tree.root.findAll((n) => n.props?.testID === id);
  return { tree, all };
}

describe("AppearanceSettingsScreen", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockPreference = "system";
  });

  it("has the page title and lead from the settings navigation", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("settingsPages.items.appearance.title");
    expect(json).toContain("settingsPages.items.appearance.lead");
  });

  it("renders the language dropdown", () => {
    const { all } = render();
    expect(all("appearance-language").length).toBeGreaterThan(0);
  });

  it("offers Világos, Sötét and Rendszer szerint as a radiogroup with the current choice checked", () => {
    mockPreference = "dark";
    const { all, tree } = render();
    expect(tree.root.findAll((n) => n.props?.accessibilityRole === "radiogroup")).not.toHaveLength(0);
    const radio = (v: string) => all(`theme-cards-${v}`).find((n) => n.props.accessibilityRole === "radio")!;
    expect(radio("light").props.accessibilityLabel).toBe("settingsPages.appearance.themes.light");
    expect(radio("dark").props.accessibilityState.checked).toBe(true);
    expect(radio("system").props.accessibilityState.checked).toBe(false);
  });

  it.each(["light", "dark"] as const)("choosing %s writes it through setTheme", (choice) => {
    mockPreference = choice === "dark" ? "light" : "dark";
    const { all } = render();
    const radio = all(`theme-cards-${choice}`).find((n) => n.props.accessibilityRole === "radio")!;
    act(() => radio.props.onPress());
    expect(mockSetTheme).toHaveBeenCalledWith(choice);
  });

  it("choosing Rendszer szerint writes system", () => {
    mockPreference = "dark";
    const { all } = render();
    const radio = all("theme-cards-system").find((n) => n.props.accessibilityRole === "radio")!;
    act(() => radio.props.onPress());
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
