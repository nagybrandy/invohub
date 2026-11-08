// components/invoices/composer/StepPartner.test.tsx
// Owner feedback 2026-11-06: the partner suggestion list opened *behind* the
// partner-details card and over the "Másolás korábbi számlából" link. On web
// every RN View is its own stacking context (z-index: 0), so the picker's
// inner z-40 never competed with its later siblings — the wrapping field
// itself has to out-stack them.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StepPartner } from "@/components/invoices/composer/StepPartner";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";

jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useCompanySearch", () => ({
  useCompanySearch: () => ({ results: [], loading: false }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/layout/AnchoredPopover", () => ({
  MENU_PANEL_CLASS: "",
  AnchoredPopover: ({ anchor }: { anchor: React.ReactNode }) => anchor,
}));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/input", () => {
  const ReactLib = require("react");
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: ReactLib.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      ReactLib.createElement(TextInput, { ref, ...props })
    ),
  };
});

const t = (key: string) => key;

function composer(overrides: Partial<InvoiceComposerState> = {}) {
  const noop = jest.fn();
  return {
    t,
    clients: [],
    clientId: undefined,
    clientName: "abc",
    clientTaxNumber: "",
    clientEmail: "",
    clientCountry: "Magyarország",
    clientZip: "",
    clientCity: "",
    clientAddress: "",
    setClientName: noop,
    setClientTaxNumber: noop,
    setClientEmail: noop,
    setClientCountry: noop,
    setClientZip: noop,
    setClientCity: noop,
    setClientAddress: noop,
    handleSelectClient: noop,
    clearClient: noop,
    showClientDetails: true,
    setShowClientDetails: noop,
    errors: {},
    focusField: null,
    clearFocusField: noop,
    copyInvoices: [],
    ...overrides,
  } as unknown as InvoiceComposerState & { copyInvoices: never[] };
}

function zIndexOf(className: string): number {
  const match = className.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
  return match ? Number(match[1]) : 0;
}

describe("StepPartner — suggestion list stacking", () => {
  it("stacks the partner field above the copy-from link and the partner details card", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StepPartner {...composer()} />);
    });

    const field = tree.root.findAll(
      (n) =>
        n.props?.testID === "form-field" &&
        n.findAll((c) => c.props?.testID === "composer-partner-picker").length > 0
    )[0];
    expect(field).toBeTruthy();
    const fieldClass = String(field.props.className ?? "");
    expect(fieldClass).toContain("relative");
    expect(zIndexOf(fieldClass)).toBeGreaterThanOrEqual(30);

    // The later siblings it must cover are in the tree, and neither out-stacks it.
    for (const id of ["composer-copy-from", "composer-partner-details"]) {
      const sibling = tree.root.findAll((n) => n.props?.testID === id)[0];
      expect(sibling).toBeTruthy();
      expect(zIndexOf(String(sibling.props.className ?? ""))).toBeLessThan(zIndexOf(fieldClass));
    }
  });

  it("renders the suggestion list inside the stacked field, with the copy link after it in the tree", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StepPartner {...composer()} />);
    });
    act(() => {
      tree.root.findAll((n) => n.props?.testID === "composer-partner-search")[0].props.onFocus?.();
    });
    expect(tree.root.findAll((n) => n.props?.testID === "composer-partner-results").length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain("invoices.composer.noPartnerResults");
    expect(tree.root.findAll((n) => n.props?.testID === "composer-copy-from").length).toBeGreaterThan(0);
  });
});
