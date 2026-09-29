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

  it("sizes each option pill to the 44px tap-target floor (min-h-11), matching the header bell", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LanguageSwitcher />);
    });
    const hu = tree.root.findByProps({ testID: "language-switcher-hu" });
    const en = tree.root.findByProps({ testID: "language-switcher-en" });
    expect(String(hu.props.className)).toContain("min-h-11");
    expect(String(en.props.className)).toContain("min-h-11");
  });

  it("does not switch language when the already-active language is pressed (no-op)", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<LanguageSwitcher />);
    });
    await act(async () => {
      tree.root.findByProps({ testID: "language-switcher-hu" }).props.onPress();
      await Promise.resolve();
    });
    expect(mockSetAppLanguage).not.toHaveBeenCalled();
  });

  describe("touch geometry", () => {
    it("trims the first pill's (HU) right slop to 0 because it faces the EN pill", async () => {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(() => {
        tree = TestRenderer.create(<LanguageSwitcher />);
      });
      const hu = tree.root.findByProps({ testID: "language-switcher-hu" });
      expect(hu.props.hitSlop.right).toBe(0);
      expect(hu.props.hitSlop.left).toBe(8);
    });

    it("trims the last pill's (EN) left slop to 0 because it faces the HU pill", async () => {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(() => {
        tree = TestRenderer.create(<LanguageSwitcher />);
      });
      const en = tree.root.findByProps({ testID: "language-switcher-en" });
      expect(en.props.hitSlop.left).toBe(0);
      expect(en.props.hitSlop.right).toBe(8);
    });

    it("keeps top/bottom slop and the 44px floor on every pill", async () => {
      let tree!: TestRenderer.ReactTestRenderer;
      await act(() => {
        tree = TestRenderer.create(<LanguageSwitcher />);
      });
      const hu = tree.root.findByProps({ testID: "language-switcher-hu" });
      const en = tree.root.findByProps({ testID: "language-switcher-en" });
      for (const pill of [hu, en]) {
        expect(pill.props.hitSlop.top).toBe(8);
        expect(pill.props.hitSlop.bottom).toBe(8);
        expect(String(pill.props.className)).toContain("min-h-11");
      }
    });
  });
});
