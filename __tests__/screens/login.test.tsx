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

// The layout shell has its own tests (components/auth/AuthLayout.test.tsx);
// here it only passes the card content through.
jest.mock("@/components/auth/AuthLayout", () => {
  const { View, Text } = require("react-native");
  return {
    AuthLayout: ({ children }: { children?: React.ReactNode }) => <View testID="auth-layout">{children}</View>,
    AuthCardHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
      </View>
    ),
    AuthNote: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <Text testID={testID}>{children}</Text>
    ),
  };
});

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/layout/FormField", () => ({
  FormField: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/segmented-control", () => ({
  SegmentedControl: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ value: string; label: string; testID?: string }>;
    value: string;
    onChange: (value: string) => void;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <>
        {options.map((option) => (
          <Pressable
            key={option.value}
            testID={option.testID}
            accessibilityState={{ selected: option.value === value }}
            onPress={() => onChange(option.value)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </>
    );
  },
}));
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

async function renderLogin() {
  const Login = require("@/app/login").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Login />);
    await Promise.resolve();
  });
  return tree!;
}

function byTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((node) => node.props?.testID === testID && typeof node.props?.onPress === "function")[0];
}

function allText(tree: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

async function submit(tree: TestRenderer.ReactTestRenderer) {
  const submitButton = byTestId(tree.root, "login-submit");
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

describe("Login — layout and mode switch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders inside the auth layout with the sign-in copy and the forgot-password link", async () => {
    const tree = await renderLogin();
    expect(tree.root.findAllByProps({ testID: "auth-layout" }).length).toBeGreaterThan(0);
    const text = allText(tree);
    expect(text).toContain("auth.welcomeBack");
    expect(text).toContain("auth.signInSubtitle");
    expect(text).toContain("login-forgot-password");
    expect(text).not.toContain("signup-role-picker");
  });

  it("switches to the sign-up form from the segmented control and from the link under the button", async () => {
    const tree = await renderLogin();
    await act(async () => {
      byTestId(tree.root, "login-mode-signup").props.onPress();
    });
    let text = allText(tree);
    expect(text).toContain("auth.createAccount");
    expect(text).toContain("signup-role-picker");
    expect(text).not.toContain("login-forgot-password");

    await act(async () => {
      byTestId(tree.root, "login-switch-mode").props.onPress();
    });
    text = allText(tree);
    expect(text).toContain("auth.welcomeBack");
  });

  it("sends the chosen account type with a sign-up and shows the error note on failure", async () => {
    mockSignUpEmail.mockResolvedValue({ error: { message: "Email taken" } });
    const tree = await renderLogin();
    await act(async () => {
      byTestId(tree.root, "login-mode-signup").props.onPress();
    });
    await act(async () => {
      byTestId(tree.root, "signup-role-accountant").props.onPress();
    });
    await act(async () => {
      byTestId(tree.root, "login-submit").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSignUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ signupRole: "accountant" }),
    );
    expect(allText(tree)).toContain("Email taken");
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
