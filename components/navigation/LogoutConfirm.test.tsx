// components/navigation/LogoutConfirm.test.tsx
// "Kijelentkezel?": Mégse / Esc / scrim never sign out; Kijelentkezés does, once.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "shell.logout.title": "Kijelentkezel?",
        "shell.logout.text": "Ezen az eszközön kilépsz az InvoHubból. A mentetlen módosítások nem vesznek el.",
        "shell.logout.cancel": "Mégse",
        "shell.logout.confirm": "Kijelentkezés",
      })[key] ?? key,
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", destructive: "#c00", primary: "#00c" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "heading", "text", "pressable"]) jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, isDisabled, onPress, testID, variant }: never) => (
      <Pressable testID={testID} data-variant={variant} accessibilityState={{ disabled: !!isDisabled }} onPress={isDisabled ? undefined : onPress}>
        {children}
      </Pressable>
    ),
    ButtonText: ({ children }: never) => <Text>{children}</Text>,
    ButtonSpinner: () => null,
  };
});

import { LogoutConfirm, useLogoutConfirm } from "@/components/navigation/LogoutConfirm";

function renderDialog(props: Partial<React.ComponentProps<typeof LogoutConfirm>> = {}) {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<LogoutConfirm open onCancel={onCancel} onConfirm={onConfirm} {...props} />);
  });
  return { tree, onCancel, onConfirm };
}

describe("LogoutConfirm", () => {
  it("asks Kijelentkezel? with the explanation and the Mégse / Kijelentkezés buttons", () => {
    const { tree } = renderDialog();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Kijelentkezel?");
    expect(json).toContain("Ezen az eszközön kilépsz az InvoHubból. A mentetlen módosítások nem vesznek el.");
    expect(json).toContain("Mégse");
    expect(json).toContain("Kijelentkezés");
  });

  it("the confirm button is the solid red one", () => {
    const { tree } = renderDialog();
    expect(tree.root.findByProps({ testID: "logout-confirm-confirm" }).props.variant).toBe("dangerSolid");
  });

  it("Mégse and the scrim cancel without confirming", () => {
    const { tree, onCancel, onConfirm } = renderDialog();
    act(() => tree.root.findByProps({ testID: "logout-confirm-cancel" }).props.onPress());
    act(() => tree.root.findByProps({ testID: "logout-confirm-scrim" }).props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Kijelentkezés confirms", () => {
    const { tree, onConfirm, onCancel } = renderDialog();
    act(() => tree.root.findByProps({ testID: "logout-confirm-confirm" }).props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders nothing visible while closed", () => {
    const { tree } = renderDialog({ open: false });
    expect(JSON.stringify(tree.toJSON())).not.toContain("Kijelentkezel?");
  });
});

describe("useLogoutConfirm", () => {
  function setup(signOut: () => void | Promise<void>) {
    const ref: { current: ReturnType<typeof useLogoutConfirm> | null } = { current: null };
    function Host() {
      ref.current = useLogoutConfirm(signOut);
      return null;
    }
    act(() => {
      TestRenderer.create(<Host />);
    });
    return ref;
  }

  it("request opens, cancel closes without signing out", () => {
    const signOut = jest.fn();
    const ref = setup(signOut);
    expect(ref.current!.open).toBe(false);
    act(() => ref.current!.request());
    expect(ref.current!.open).toBe(true);
    act(() => ref.current!.cancel());
    expect(ref.current!.open).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("confirm signs out once and closes", async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    const ref = setup(signOut);
    act(() => ref.current!.request());
    await act(async () => {
      await ref.current!.confirm();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(ref.current!.open).toBe(false);
    expect(ref.current!.busy).toBe(false);
  });

  it("stays busy (and ignores cancel) while the sign-out is running", async () => {
    let finish!: () => void;
    const signOut = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const ref = setup(signOut);
    act(() => ref.current!.request());
    let pending!: Promise<void>;
    act(() => {
      pending = ref.current!.confirm();
    });
    expect(ref.current!.busy).toBe(true);
    act(() => ref.current!.cancel());
    expect(ref.current!.open).toBe(true);
    await act(async () => {
      finish();
      await pending;
    });
    expect(ref.current!.open).toBe(false);
  });
});
