// __tests__/screens/auth-screens.test.tsx
// Forgot password, reset password and the invite landing share AuthLayout and
// keep their behaviour and messages (SPEC §10.3). Notes are ok-wash / err-wash.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockParams.local,
}));
const mockParams: { local: Record<string, string | undefined> } = { local: {} };
jest.mock("@/lib/routing/route-param", () => ({
  useRouteParam: (name: string) => mockParams.local[name],
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string; defaultValue?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));
jest.mock("@/components/auth/AuthLayout", () => {
  const actual = jest.requireActual("@/components/auth/AuthLayout");
  const { View } = require("react-native");
  return {
    ...actual,
    AuthLayout: ({ children }: { children?: React.ReactNode }) => <View testID="auth-layout">{children}</View>,
  };
});

const mockRequestReset = jest.fn();
const mockResetPassword = jest.fn();
let mockSession: { data: unknown; isPending: boolean } = { data: null, isPending: false };
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: (...args: unknown[]) => mockRequestReset(...args),
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
  useSession: () => mockSession,
}));
jest.mock("@/lib/auth-url", () => ({ getAuthBaseUrl: () => "https://app.test" }));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => {
  class ApiError extends Error {
    code?: string;
  }
  return { ApiError, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});
const mockRemember = jest.fn();
jest.mock("@/lib/workspaces/pending-invite", () => ({
  rememberPendingInvite: (...args: unknown[]) => mockRemember(...args),
  clearPendingInvite: jest.fn(),
}));
jest.mock("@/lib/workspaces/active-client", () => ({ setActiveAccountId: jest.fn() }));

async function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(element);
    await Promise.resolve();
  });
  return tree;
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll((n) => n.props?.testID === testID && typeof n.props?.onPress === "function")[0];
}

function type(tree: TestRenderer.ReactTestRenderer, testID: string, value: string) {
  const field = tree.root.findAll((n) => n.props?.testID === testID && typeof n.props?.onChangeText === "function")[0];
  act(() => field.props.onChangeText(value));
}

const json = (tree: TestRenderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.local = {};
  mockSession = { data: null, isPending: false };
});

describe("ForgotPasswordScreen", () => {
  const Screen = () => require("@/app/forgot-password").default();

  it("shows the title, subtitle and the email field inside the auth layout", async () => {
    const tree = await render(<Screen />);
    const text = json(tree);
    expect(text).toContain("auth-layout");
    expect(text).toContain("auth.reset.requestTitle");
    expect(text).toContain("auth.reset.requestSubtitle");
    expect(text).toContain("forgot-password-email");
  });

  it("asks for a reset link and then shows the ok note instead of the form", async () => {
    mockRequestReset.mockResolvedValue({ error: null });
    const tree = await render(<Screen />);
    type(tree, "forgot-password-email", " me@example.com ");
    await act(async () => {
      press(tree, "forgot-password-submit").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRequestReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: "me@example.com", redirectTo: expect.stringContaining("/reset-password") }),
    );
    const text = json(tree);
    expect(text).toContain("forgot-password-sent");
    expect(text).toContain("auth.reset.requestSent");
    expect(text).not.toContain("forgot-password-email");
  });

  it("shows the err note when sending fails", async () => {
    mockRequestReset.mockResolvedValue({ error: { message: "nope" } });
    const tree = await render(<Screen />);
    type(tree, "forgot-password-email", "me@example.com");
    await act(async () => {
      press(tree, "forgot-password-submit").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(json(tree)).toContain("auth.reset.requestFailed");
    expect(json(tree)).toContain("forgot-password-error");
  });

  it("goes back to the login", async () => {
    const tree = await render(<Screen />);
    act(() => press(tree, "auth-back-to-login").props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});

describe("ResetPasswordScreen", () => {
  const Screen = () => require("@/app/reset-password").default();

  it("explains an invalid or missing link and offers a new request", async () => {
    const tree = await render(<Screen />);
    expect(json(tree)).toContain("reset-password-invalid");
    act(() => press(tree, "reset-password-request-new").props.onPress());
    expect(mockReplace).toHaveBeenCalledWith("/forgot-password");
  });

  it("validates before saving and saves with the token", async () => {
    mockParams.local = { token: "tok_1" };
    mockResetPassword.mockResolvedValue({ error: null });
    const tree = await render(<Screen />);

    type(tree, "reset-password-new", "short");
    type(tree, "reset-password-confirm", "short");
    await act(async () => {
      press(tree, "reset-password-submit").props.onPress();
    });
    expect(json(tree)).toContain("auth.reset.tooShort");
    expect(mockResetPassword).not.toHaveBeenCalled();

    type(tree, "reset-password-new", "longenough1");
    type(tree, "reset-password-confirm", "different11");
    await act(async () => {
      press(tree, "reset-password-submit").props.onPress();
    });
    expect(json(tree)).toContain("auth.reset.mismatch");

    type(tree, "reset-password-confirm", "longenough1");
    await act(async () => {
      press(tree, "reset-password-submit").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockResetPassword).toHaveBeenCalledWith({ newPassword: "longenough1", token: "tok_1" });
    expect(json(tree)).toContain("reset-password-done");
    act(() => press(tree, "reset-password-to-login").props.onPress());
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

describe("InviteScreen", () => {
  const Screen = () => require("@/app/invite").default();

  it("remembers the token and asks signed-out visitors to sign in", async () => {
    mockParams.local = { token: "inv_1" };
    const tree = await render(<Screen />);
    expect(mockRemember).toHaveBeenCalledWith("inv_1");
    expect(json(tree)).toContain("invite.needLogin");
    expect(mockApiFetch).not.toHaveBeenCalled();
    act(() => press(tree, "invite-login").props.onPress());
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows the not-found error for a link without a token", async () => {
    const tree = await render(<Screen />);
    expect(json(tree)).toContain("invite.errors.notFound");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
