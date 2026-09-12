// components/i18n/LanguageSwitcher.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { setAppLanguage } from "@/lib/i18n/language";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "hu" },
  }),
}));

jest.mock("@/lib/i18n/language", () => ({
  APP_LANGUAGES: [
    { code: "hu", label: "Magyar", shortLabel: "HU" },
    { code: "en", label: "English", shortLabel: "EN" },
  ],
  setAppLanguage: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const mockSetAppLanguage = setAppLanguage as jest.MockedFunction<typeof setAppLanguage>;

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    mockSetAppLanguage.mockClear();
  });

  it("renders HU and EN options", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LanguageSwitcher />);
    });
    expect(tree.root.findByProps({ testID: "language-switcher-hu" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "language-switcher-en" })).toBeTruthy();
  });

  it("switches to English when EN is pressed", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LanguageSwitcher />);
    });
    await act(async () => {
      tree.root.findByProps({ testID: "language-switcher-en" }).props.onPress();
      await Promise.resolve();
    });
    expect(mockSetAppLanguage).toHaveBeenCalledWith("en");
  });
});
