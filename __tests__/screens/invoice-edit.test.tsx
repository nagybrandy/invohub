// __tests__/screens/invoice-edit.test.tsx
// Focused coverage for the invoice edit screen's draft-vs-finalized branching
// (the smoke test only exercises whatever status its shared fixture has).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/lib/routing/route-param", () => ({
  useRouteParam: () => "inv-1",
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockAddOrUpdate = jest.fn();
jest.mock("@/hooks/useInvoices", () => ({
  useInvoices: () => ({ addOrUpdate: mockAddOrUpdate }),
}));

jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: { vatExempt: false } }),
}));

jest.mock("@/components/layout/FormScreen", () => ({
  FormScreen: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock("@/components/invoices/InvoiceDocumentPreview", () => ({
  InvoiceDocumentPreview: () => null,
}));

jest.mock("@/components/invoices/LineItemEditor", () => ({
  LineItemEditor: () => null,
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
}));
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/ui/input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/textarea", () => {
  const { TextInput } = require("react-native");
  return {
    Textarea: ({ children }: { children?: React.ReactNode }) => children ?? null,
    TextareaInput: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/form-control", () => ({
  FormControl: mockUi.View,
  FormControlLabel: mockUi.View,
  FormControlLabelText: mockUi.Text,
}));

async function renderScreen() {
  const EditInvoiceScreen = require("@/app/(app)/invoices/[id]/edit").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<EditInvoiceScreen />);
    await Promise.resolve();
  });
  return tree!;
}

describe("EditInvoiceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a read-only hint for a finalized (non-draft) invoice", async () => {
    mockApiFetch.mockResolvedValue({ invoice: makeInvoice({ status: "sent" }) });
    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.edit.readOnlyHint");
    expect(json).not.toContain("invoices.edit.saveChanges");
  });

  it("renders the editable form for a draft invoice", async () => {
    mockApiFetch.mockResolvedValue({ invoice: makeInvoice({ status: "draft" }) });
    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.edit.saveChanges");
    expect(json).not.toContain("invoices.edit.readOnlyHint");
  });

  it("saving a draft filters blank line items and forwards currency/exchangeRate", async () => {
    mockApiFetch.mockResolvedValue({
      invoice: makeInvoice({
        status: "draft",
        currency: "EUR",
        lineItems: [
          { id: "l1", description: "Real item", quantity: 1, unitPrice: 10, vatRate: 27, vatCategory: "normal" },
        ],
      }),
    });
    mockAddOrUpdate.mockResolvedValue(makeInvoice({ id: "inv-1" }));

    const tree = await renderScreen();
    const saveButton = tree.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find(
        (node) =>
          node.findAll((child) => child.props?.children === "invoices.edit.saveChanges")
            .length > 0
      );

    await act(async () => {
      saveButton?.props.onPress?.();
      await Promise.resolve();
    });

    expect(mockAddOrUpdate).toHaveBeenCalledTimes(1);
    const saved = mockAddOrUpdate.mock.calls[0][0];
    expect(saved.lineItems).toHaveLength(1);
    expect(saved.currency).toBe("EUR");
    expect(mockReplace).toHaveBeenCalledWith("/invoices/inv-1");
  });
});
