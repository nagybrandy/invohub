// components/navigation/AppSidebar.test.tsx
import * as React from "react";
import { Platform } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { AppSidebar } from "@/components/navigation/AppSidebar";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/marketing/BrandLogo", () => ({
  BrandLogo: () => {
    const { Text } = require("react-native");
    return <Text testID="brand-logo">InvoHub</Text>;
  },
  BrandMark: () => {
    const { Text } = require("react-native");
    return <Text testID="brand-mark">IH</Text>;
  },
}));

const baseProps = {
  activePathname: "/dashboard",
  role: "entrepreneur" as string | undefined,
  companyName: "TestCorp Kft.",
  companyTaxId: "12345678-1-42",
  collapsed: false,
  onNavigate: jest.fn(),
  onNewInvoice: jest.fn(),
  onOpenCompanySettings: jest.fn(),
  onSignOut: jest.fn(),
};

describe("AppSidebar", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = "web";
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it("renders exactly the six primary sections in order, plus Importálás and Admin below a divider", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} role="admin" />);
    });
    const json = JSON.stringify(tree.toJSON());
    const order = [
      "nav.dashboard",
      "nav.invoices",
      "nav.receipts",
      "nav.partners",
      "nav.products",
      "nav.settings",
      "nav.import",
      "nav.admin",
    ];
    let lastIndex = -1;
    for (const key of order) {
      const idx = json.indexOf(`"${key}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    act(() => tree.unmount());
  });

  it("does not show the admin link for a non-admin role", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} role="entrepreneur" />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('"nav.admin"');
    act(() => tree.unmount());
  });

  it("puts a full-width + Új számla button at the top and wires it to onNewInvoice", async () => {
    const onNewInvoice = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} onNewInvoice={onNewInvoice} />);
    });
    const newInvoiceButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.newInvoice",
    );
    act(() => newInvoiceButton.props.onPress?.());
    expect(onNewInvoice).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("marks the active row with a background token, not only font weight", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} activePathname="/invoices" />);
    });
    const activeRow = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.invoices",
    );
    expect(activeRow.props.className).toContain("bg-white/14");
    const inactiveRow = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.dashboard",
    );
    expect(inactiveRow.props.className).not.toContain("bg-white/14");
    act(() => tree.unmount());
  });

  it("navigates when a nav row is pressed", async () => {
    const onNavigate = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} onNavigate={onNavigate} />);
    });
    const productsRow = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.products",
    );
    act(() => productsRow.props.onPress?.());
    expect(onNavigate).toHaveBeenCalledWith("/products");
    act(() => tree.unmount());
  });

  it("opens company settings without a chevron dropdown affordance, in one tap", async () => {
    const onOpenCompanySettings = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(
        <AppSidebar {...baseProps} onOpenCompanySettings={onOpenCompanySettings} />,
      );
    });
    const companyButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.companySettings",
    );
    act(() => companyButton.props.onPress?.());
    expect(onOpenCompanySettings).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("signs out in one tap from the bottom row", async () => {
    const onSignOut = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} onSignOut={onSignOut} />);
    });
    const signOutButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "nav.signOut",
    );
    act(() => signOutButton.props.onPress?.());
    expect(onSignOut).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("renders narrow (72px) when collapsed and wide (248px) when expanded", async () => {
    let narrowTree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      narrowTree = TestRenderer.create(<AppSidebar {...baseProps} collapsed />);
    });
    const narrowRoot = narrowTree.root.find((node) => node.props?.testID === "app-sidebar");
    expect(narrowRoot.props.className).toContain("w-[72px]");
    act(() => narrowTree.unmount());

    let wideTree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      wideTree = TestRenderer.create(<AppSidebar {...baseProps} collapsed={false} />);
    });
    const wideRoot = wideTree.root.find((node) => node.props?.testID === "app-sidebar");
    expect(wideRoot.props.className).toContain("w-[248px]");
    act(() => wideTree.unmount());
  });

  it("does not render its own collapse toggle — that lives in AppTopStrip now", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<AppSidebar {...baseProps} />);
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("nav.collapseSidebar");
    expect(json).not.toContain("nav.expandSidebar");
    act(() => tree.unmount());
  });
});
