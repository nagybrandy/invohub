import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key),
    i18n: { language: "hu" },
  }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/layout/FormField", () => ({
  FormField: ({ children }: { children?: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    InputField: (p: Record<string, unknown>) => <TextInput {...p} />,
  };
});
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    Button: ({ testID, children, onPress, isDisabled }: any) => (
      <Pressable testID={testID} onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
    ),
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
    ButtonSpinner: () => <View />,
  };
});
jest.mock("@/components/ui/confirm-dialog", () => {
  const { Pressable, View } = require("react-native");
  return {
    ConfirmDialog: ({ open, onConfirm, testID }: any) =>
      open ? <View testID={testID}><Pressable testID={`${testID}-confirm`} onPress={onConfirm} /></View> : null,
  };
});
jest.mock("@/components/settings/SettingsSheet", () => {
  const { View, Text } = require("react-native");
  return {
    SettingsSheet: ({ children, testID }: any) => <View testID={testID}>{children}</View>,
    SettingsSection: ({ title, hint, children }: any) => (
      <View><Text>{title}</Text>{hint ? <Text>{hint}</Text> : null}{children}</View>
    ),
    SettingsNote: ({ children, testID }: any) => <Text testID={testID}>{children}</Text>,
  };
});

const mockHook = jest.fn();
jest.mock("@/hooks/useAccountDeletion", () => ({ useAccountDeletion: () => mockHook() }));

const { AccountDeletionSection } = require("@/components/settings/AccountDeletionSection");

const base = { request: null, loading: false, error: null, requestDeletion: jest.fn(), cancelRequest: jest.fn(), refresh: jest.fn() };
const render = (props: { enabled?: boolean } = {}) => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<AccountDeletionSection {...props} />);
  });
  return tree;
};
const byId = (t: TestRenderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props.testID === id && typeof n.type !== "string")[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockHook.mockReturnValue({ ...base, requestDeletion: jest.fn().mockResolvedValue(undefined), cancelRequest: jest.fn().mockResolvedValue(undefined) });
});

describe("AccountDeletionSection", () => {
  it("renders nothing when the flag is off (default)", () => {
    const tree = render({ enabled: false });
    expect(tree.toJSON()).toBeNull();
    expect(mockHook).not.toHaveBeenCalled(); // not even a status fetch
  });

  it("with the env flag unset the default is off", () => {
    expect(render().toJSON()).toBeNull();
  });

  it("shows the export link first and what is kept / removed", () => {
    const tree = render({ enabled: true });
    expect(byId(tree, "account-deletion-kept")).toBeTruthy();
    expect(byId(tree, "account-deletion-removed")).toBeTruthy();
    act(() => byId(tree, "account-deletion-export").props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/export");
  });

  it("requesting needs the confirm dialog; confirm sends the request", async () => {
    const hook = mockHook();
    const tree = render({ enabled: true });
    expect(byId(tree, "account-deletion-confirm").props.open).toBe(false);
    act(() => byId(tree, "account-deletion-request").props.onPress());
    expect(byId(tree, "account-deletion-confirm").props.open).toBe(true);
    expect(hook.requestDeletion).not.toHaveBeenCalled();
    await act(async () => {
      await byId(tree, "account-deletion-confirm-confirm").props.onPress();
    });
    expect(hook.requestDeletion).toHaveBeenCalledTimes(1);
  });

  it("with an open request it offers withdrawal instead of a second request", async () => {
    const hook = { ...base, request: { id: "r1", status: "requested", requestedAt: "2026-11-08", scheduledFor: "2026-12-08" }, cancelRequest: jest.fn().mockResolvedValue(undefined) };
    mockHook.mockReturnValue(hook);
    const tree = render({ enabled: true });
    expect(byId(tree, "account-deletion-request")).toBeUndefined();
    await act(async () => {
      await byId(tree, "account-deletion-cancel").props.onPress();
    });
    expect(hook.cancelRequest).toHaveBeenCalled();
  });
});
