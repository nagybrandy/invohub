// __tests__/screens/invoice-detail.test.tsx
// Focused coverage for the invoice detail screen's new mark-paid/correction/links behavior.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

jest.mock("@/lib/routing/route-param", () => ({
  useRouteParam: () => "inv-1",
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("@/components/invoices/InvoiceDocumentPreview", () => ({
  InvoiceDocumentPreview: () => null,
}));

jest.mock("@/components/layout/PageHeader", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return { PageHeader: mockUi.View };
});
jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/badge", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
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

async function renderScreen() {
  const InvoiceDetailScreen = require("@/app/(app)/invoices/[id]/index").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<InvoiceDetailScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

describe("InvoiceDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows related documents when the invoice has a storno original", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return {
          originalInvoice: { id: "inv-0", invoiceNumber: "INV-2026-000" },
          modifiesInvoice: null,
          stornoDocuments: [],
          correctionDocuments: [],
        };
      }
      return { invoice: makeInvoice({ id: "inv-1", originalInvoiceId: "inv-0" }) };
    });

    const tree = await renderScreen();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.links.title");
    expect(json).toContain("INV-2026-000");
  });

  it("mark-paid panel toggles and posts payment on confirm", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/mark-paid")) {
        expect(init?.method).toBe("POST");
        return { invoice: makeInvoice({ id: "inv-1", status: "paid" }) };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const tree = await renderScreen();

    const toggleButton = findPressableWithText(tree.root, "invoices.markPaid.action");
    await act(async () => {
      toggleButton?.props.onPress?.();
    });

    const confirmButton = findPressableWithText(tree.root, "invoices.markPaid.confirm");
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const markPaidCall = mockApiFetch.mock.calls.find(([path]) => path.includes("/mark-paid"));
    expect(markPaidCall).toBeTruthy();
  });

  it("the mark-paid button is disabled for a draft invoice", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "draft" }) };
    });

    const tree = await renderScreen();
    const toggleButton = findPressableWithText(tree.root, "invoices.markPaid.action");
    expect(toggleButton?.props.disabled).toBe(true);
  });

  it("correction action confirms via Alert then navigates to the new draft's edit screen", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/links")) {
        return { originalInvoice: null, modifiesInvoice: null, stornoDocuments: [], correctionDocuments: [] };
      }
      if (path.includes("/modify")) {
        return { invoice: makeInvoice({ id: "modify-1", documentType: "modify" }) };
      }
      return { invoice: makeInvoice({ id: "inv-1", status: "sent" }) };
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === "invoices.correction.confirm");
      confirm?.onPress?.();
    });

    const tree = await renderScreen();
    const correctionButton = findPressableWithText(tree.root, "invoices.correction.action");

    await act(async () => {
      correctionButton?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/modify-1/edit");
    alertSpy.mockRestore();
  });
});
