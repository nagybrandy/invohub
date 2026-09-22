// __tests__/screens/login.test.tsx
// After a successful sign-in/sign-up, login.tsx now checks the company
// profile and routes to onboarding when it's incomplete instead of always
// going straight to the dashboard (finalizing an invoice is refused
// server-side until the profile is filled in — lib/companies/completeness.ts).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockSignInEmail = jest.fn();
const mockSignUpEmail = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args) },
    signUp: { email: (...args: unknown[]) => mockSignUpEmail(...args) },
  },
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("@/components/marketing/BrandLogo", () => ({
  BrandLogo: () => null,
}));

jest.mock("@/components/i18n/LanguageSwitcher", () => ({
  LanguageSwitcher: () => null,
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

async function renderLogin() {
  const Login = require("@/app/login").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Login />);
    await Promise.resolve();
  });
  return tree!;
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

async function submit(tree: TestRenderer.ReactTestRenderer) {
  const submitButton = findPressableWithText(tree.root, "auth.signIn");
  await act(async () => {
    submitButton?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Login — post-auth company-profile redirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes to onboarding when the company profile is incomplete after sign-in", async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    mockApiFetch.mockResolvedValue({ company: { name: "Acme Kft." } }); // missing taxNumber/address/city/zipCode

    const tree = await renderLogin();
    await submit(tree);

    expect(mockApiFetch).toHaveBeenCalledWith("/api/companies");
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });

  it("routes to the dashboard when the company profile is already complete", async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    mockApiFetch.mockResolvedValue({
      company: {
        name: "Acme Kft.",
        taxNumber: "12345678-1-23",
        zipCode: "1011",
        city: "Budapest",
        address: "Fő utca 1.",
      },
    });

    const tree = await renderLogin();
    await submit(tree);

    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("routes to onboarding when there is no company row at all (brand-new user)", async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    mockApiFetch.mockResolvedValue({ company: null });

    const tree = await renderLogin();
    await submit(tree);

    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });

  it("falls back to the dashboard (never blocks sign-in) when the profile check itself fails", async () => {
    mockSignInEmail.mockResolvedValue({ error: null });
    mockApiFetch.mockRejectedValue(new Error("network down"));

    const tree = await renderLogin();
    await submit(tree);

    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("never checks the profile (or redirects) when sign-in itself fails", async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: "Invalid credentials" } });

    const tree = await renderLogin();
    await submit(tree);

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
