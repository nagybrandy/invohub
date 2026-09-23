// __tests__/screens/onboarding.test.tsx
// The "company name is required" error used to be hardcoded English
// (t("company.onboarding.companyName") + " required.") regardless of the
// active language — now it's a real translation key.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSave = jest.fn();
jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: null, loading: false, save: (...args: unknown[]) => mockSave(...args) }),
}));

jest.mock("@/components/settings/NavEnvironmentPicker", () => ({
  NavEnvironmentPicker: () => null,
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
  ButtonSpinner: mockUi.View,
}));
jest.mock("@/components/ui/input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/form-control", () => ({
  FormControl: mockUi.View,
  FormControlLabel: mockUi.View,
  FormControlLabelText: mockUi.Text,
}));

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

function textUnder(node: TestRenderer.ReactTestInstance): string {
  return node
    .findAll((n) => typeof n.props?.children === "string")
    .map((n) => n.props.children as string)
    .join(" | ");
}

async function renderOnboarding() {
  const OnboardingScreen = require("@/app/(app)/onboarding").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<OnboardingScreen />);
    await Promise.resolve();
  });
  return tree!;
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a translated (i18n-keyed) error, not hardcoded English, when saving with no company name", async () => {
    const tree = await renderOnboarding();
    const saveButton = findPressableWithText(tree.root, "company.onboarding.save");

    await act(async () => {
      saveButton?.props.onPress?.();
      await Promise.resolve();
    });

    expect(mockSave).not.toHaveBeenCalled();
    // The i18n mock echoes the key itself — the OLD bug concatenated raw
    // English ("... required.") onto a (possibly Hungarian) label, which
    // this key-echoing mock would show as literal "company.onboarding.companyName required."
    // instead of a real key. This asserts a real, translatable key is used.
    expect(textUnder(tree.root)).toContain("company.onboarding.companyNameRequired");
    expect(textUnder(tree.root)).not.toContain("required.");
  });

  it("saves the company profile and advances to the NAV step when a name is given", async () => {
    mockSave.mockResolvedValue({});
    const tree = await renderOnboarding();

    // By testID, not by placeholder copy: the placeholder is translated now
    // (company.onboarding.companyNamePlaceholder), and a test that pins the
    // Hungarian string breaks on every wording change.
    const nameInput = tree.root.findAllByProps({ testID: "onboarding-company-name" })[0];
    await act(async () => {
      nameInput.props.onChangeText("Acme Kft.");
    });

    const saveButton = findPressableWithText(tree.root, "company.onboarding.save");
    await act(async () => {
      saveButton?.props.onPress?.();
      await Promise.resolve();
    });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Kft." })
    );
    // Advancing to step 2 swaps the visible heading to the NAV setup card.
    expect(textUnder(tree.root)).toContain("company.onboarding.navSetup");
  });
});
