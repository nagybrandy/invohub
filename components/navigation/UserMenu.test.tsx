// components/navigation/UserMenu.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { UserMenu } from "@/components/navigation/UserMenu";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

describe("UserMenu", () => {
  it("shows a monogram avatar derived from the user's name, not the company's", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <UserMenu
          userName="Teszt Elek"
          companyName="InvoHub Demo"
          onOpenAccount={jest.fn()}
          onOpenCompany={jest.fn()}
          onSignOut={jest.fn()}
        />,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('"TE"');
    act(() => tree.unmount());
  });

  it("is closed by default and opens a real menu with all three rows on avatar press", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <UserMenu
          userName="Teszt Elek"
          onOpenAccount={jest.fn()}
          onOpenCompany={jest.fn()}
          onSignOut={jest.fn()}
        />,
      );
    });
    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === "userMenu.accountSettings")
        .length,
    ).toBe(0);

    const avatar = tree.root.find((node) => node.props?.accessibilityLabel === "nav.accountSettings");
    act(() => avatar.props.onPress?.());

    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === "userMenu.accountSettings")
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === "userMenu.companyProfile")
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === "userMenu.signOut").length,
    ).toBeGreaterThan(0);
    act(() => tree.unmount());
  });

  it("signs out in one click from the menu", async () => {
    const onSignOut = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <UserMenu
          userName="Teszt Elek"
          onOpenAccount={jest.fn()}
          onOpenCompany={jest.fn()}
          onSignOut={onSignOut}
        />,
      );
    });
    const avatar = tree.root.find((node) => node.props?.accessibilityLabel === "nav.accountSettings");
    act(() => avatar.props.onPress?.());
    const signOutRow = tree.root.find(
      (node) => node.props?.accessibilityLabel === "userMenu.signOut",
    );
    act(() => signOutRow.props.onPress?.());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("calls onOpenCompany and closes when Céges profil is pressed", async () => {
    const onOpenCompany = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <UserMenu
          userName="Teszt Elek"
          onOpenAccount={jest.fn()}
          onOpenCompany={onOpenCompany}
          onSignOut={jest.fn()}
        />,
      );
    });
    const avatar = tree.root.find((node) => node.props?.accessibilityLabel === "nav.accountSettings");
    act(() => avatar.props.onPress?.());
    const companyRow = tree.root.find(
      (node) => node.props?.accessibilityLabel === "userMenu.companyProfile",
    );
    act(() => companyRow.props.onPress?.());
    expect(onOpenCompany).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findAll((node) => node.props?.accessibilityLabel === "userMenu.companyProfile")
        .length,
    ).toBe(0);
    act(() => tree.unmount());
  });
});
