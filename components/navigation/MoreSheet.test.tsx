// components/navigation/MoreSheet.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MoreSheet } from "@/components/navigation/MoreSheet";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    primary: "#6495ed",
    muted: "#64748b",
    foreground: "#0f172a",
    destructive: "#dc2626",
    accent: "#8db600",
    accentForeground: "#1f305e",
    secondary: "#111f4a",
  }),
}));

const baseProps = {
  open: true,
  onClose: jest.fn(),
  role: "entrepreneur" as string | undefined,
  onNavigate: jest.fn(),
  onSignOut: jest.fn(),
};

describe("MoreSheet", () => {
  it("lists Nyugták, Termékek, Importálás, Beállítások and Kijelentkezés", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<MoreSheet {...baseProps} />);
    });
    const json = JSON.stringify(tree.toJSON());
    for (const key of ["nav.receipts", "nav.products", "nav.import", "nav.settings", "nav.signOut"]) {
      expect(json).toContain(`"${key}"`);
    }
    expect(json).not.toContain('"nav.admin"');
    act(() => tree.unmount());
  });

  it("includes the admin panel for admins", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<MoreSheet {...baseProps} role="admin" />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('"nav.admin"');
    act(() => tree.unmount());
  });

  it("renders nothing when closed", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<MoreSheet {...baseProps} open={false} />);
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain("nav.receipts");
    act(() => tree.unmount());
  });

  it("navigates and closes when a nav item is pressed", async () => {
    const onNavigate = jest.fn();
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MoreSheet {...baseProps} onNavigate={onNavigate} onClose={onClose} />,
      );
    });
    const productsRow = tree.root.find((node) => node.props?.accessibilityLabel === "nav.products");
    act(() => productsRow.props.onPress?.());
    expect(onNavigate).toHaveBeenCalledWith("/products");
    expect(onClose).toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it("signs out and closes when Kijelentkezés is pressed", async () => {
    const onSignOut = jest.fn();
    const onClose = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <MoreSheet {...baseProps} onSignOut={onSignOut} onClose={onClose} />,
      );
    });
    const signOutRow = tree.root.find((node) => node.props?.accessibilityLabel === "nav.signOut");
    act(() => signOutRow.props.onPress?.());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
