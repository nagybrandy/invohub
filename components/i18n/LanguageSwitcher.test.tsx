// components/i18n/LanguageSwitcher.test.tsx
// The language switch is a dropdown with native names (BRIEF.md).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { setAppLanguage } from "@/lib/i18n/language";

const mockLanguage = { current: "hu" };
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: mockLanguage.current },
  }),
}));

jest.mock("@/lib/i18n/language", () => ({
  APP_LANGUAGES: [
    { code: "hu", label: "Magyar", shortLabel: "HU" },
    { code: "en", label: "English", shortLabel: "EN" },
  ],
  setAppLanguage: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", primary: "#00c", onNavy: "#ccd" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const mockSetAppLanguage = setAppLanguage as jest.MockedFunction<typeof setAppLanguage>;

async function render(props: React.ComponentProps<typeof LanguageSwitcher> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(() => {
    tree = TestRenderer.create(<LanguageSwitcher {...props} />);
  });
  return tree;
}

// The Select wrapper and its pressable field both carry the testID; the field
// is the one with the combobox role.
const field = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.testID === "language-switcher" && n.props.accessibilityRole === "combobox")[0];

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockSetAppLanguage.mockClear();
    mockLanguage.current = "hu";
  });

  it("is a labelled dropdown showing the active language by its native name", async () => {
    const tree = await render();
    const input = field(tree);
    expect(input.props.accessibilityRole).toBe("combobox");
    expect(input.props.accessibilityLabel).toBe("language.switcherLabel");
    expect(JSON.stringify(tree.toJSON())).toContain("Magyar");
  });

  it("lists Magyar and English", async () => {
    const tree = await render();
    await act(async () => {
      field(tree).props.onPress();
    });
    expect(tree.root.findByProps({ testID: "language-switcher-option-hu" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "language-switcher-option-en" })).toBeTruthy();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Magyar");
    expect(json).toContain("English");
  });

  it("switches to English when English is chosen", async () => {
    const tree = await render();
    await act(async () => {
      field(tree).props.onPress();
    });
    await act(async () => {
      tree.root.findByProps({ testID: "language-switcher-option-en" }).props.onPress();
      await Promise.resolve();
    });
    expect(mockSetAppLanguage).toHaveBeenCalledWith("en");
  });

  it("does not switch when the already-active language is chosen", async () => {
    const tree = await render();
    await act(async () => {
      field(tree).props.onPress();
    });
    await act(async () => {
      tree.root.findByProps({ testID: "language-switcher-option-hu" }).props.onPress();
      await Promise.resolve();
    });
    expect(mockSetAppLanguage).not.toHaveBeenCalled();
  });

  it("shows English when the app language is en-*", async () => {
    mockLanguage.current = "en-GB";
    const tree = await render();
    expect(JSON.stringify(tree.toJSON())).toContain("English");
  });

  it("renders a transparent white field on navy surfaces", async () => {
    const tree = await render({ tone: "onDark" });
    const className = String(field(tree).props.className);
    expect(className).toContain("bg-transparent");
    expect(className).toContain("border-white/[0.22]");
  });
});
