// components/settings/TaxAuditExportCard.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", accent: "#4f46e5" }),
}));

jest.mock("@/lib/auth-url", () => ({ getAuthBaseUrl: () => "http://app.test" }));

const mockSaveDownload = jest.fn();
jest.mock("@/components/settings/save-download", () => ({
  saveDownload: (...args: unknown[]) => mockSaveDownload(...args),
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/date-field", () => {
  const { TextInput } = require("react-native");
  return {
    DateField: ({ value, onChange, testID }: { value?: string; onChange: (v: string) => void; testID?: string }) => (
      <TextInput testID={testID} value={value} onChangeText={onChange} />
    ),
  };
});
jest.mock("@/components/ui/choice-pill", () => {
  const { Pressable, View } = require("react-native");
  return {
    ChoicePillGroup: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    ChoicePill: ({ children, onPress, testID, selected }: any) => (
      <Pressable testID={testID} onPress={onPress} accessibilityState={{ selected }}>
        {children}
      </Pressable>
    ),
  };
});
jest.mock("@/components/ui/button", () => {
  const { Pressable } = require("react-native");
  return {
    Button: ({ testID, children, onPress, disabled }: any) => (
      <Pressable testID={testID} onPress={onPress} disabled={disabled}>
        {children}
      </Pressable>
    ),
    ButtonText: mockUi.Text,
    ButtonSpinner: mockUi.View,
  };
});

const { TaxAuditExportCard } = require("@/components/settings/TaxAuditExportCard");

const fetchMock = jest.fn();

function okResponse() {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name === "Content-Disposition" ? 'attachment; filename="export.xml"' : null) },
    blob: async () => "BLOB",
  };
}

function errorResponse(status: number, body: unknown) {
  return { ok: false, status, headers: { get: () => null }, json: async () => body };
}

async function render(now = new Date("2026-09-22T10:00:00Z")) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<TaxAuditExportCard now={now} />);
  });
  return tree;
}

function byTestId(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((node) => node.props.testID === id && typeof node.type !== "string")[0];
}

async function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  await act(async () => {
    await byTestId(tree, id).props.onPress();
  });
}

async function type(tree: TestRenderer.ReactTestRenderer, id: string, value: string) {
  await act(async () => {
    const node = byTestId(tree, id);
    (node.props.onChangeText ?? node.props.onChange)(value);
  });
}

describe("TaxAuditExportCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  it("shows the statutory name and defaults to this year's date range", async () => {
    const tree = await render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("settings.taxAudit.title");
    expect(byTestId(tree, "tax-audit-from").props.value).toBe("2026-01-01");
    expect(byTestId(tree, "tax-audit-to").props.value).toBe("2026-09-22");
  });

  it("downloads the date-range export with session cookies and saves the file", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const tree = await render();
    await type(tree, "tax-audit-from", "2026-03-01");
    await press(tree, "tax-audit-download");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://app.test/api/invoices/tax-audit-export?from=2026-03-01&to=2026-09-22",
      { credentials: "include" }
    );
    expect(mockSaveDownload).toHaveBeenCalledWith("export.xml", "BLOB");
  });

  it("switches to an invoice-number range", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const tree = await render();
    await press(tree, "tax-audit-mode-number");
    await type(tree, "tax-audit-from-number", "INV-2026-00001");
    await type(tree, "tax-audit-to-number", "INV-2026-00010");
    await press(tree, "tax-audit-download");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://app.test/api/invoices/tax-audit-export?fromNumber=INV-2026-00001&toNumber=INV-2026-00010",
      { credentials: "include" }
    );
  });

  it("shows a translated error for an empty range", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, { code: "noInvoices" }));
    const tree = await render();
    await press(tree, "tax-audit-download");
    expect(JSON.stringify(tree.toJSON())).toContain("settings.taxAudit.errors.noInvoices");
    expect(mockSaveDownload).not.toHaveBeenCalled();
  });

  it("lists the invoices whose data blocks the export", async () => {
    fetchMock.mockResolvedValue(
      errorResponse(422, {
        code: "incompleteInvoiceData",
        problems: [{ invoiceNumber: "INV-2026-00007", field: "buyerZipCode" }],
      })
    );
    const tree = await render();
    await press(tree, "tax-audit-download");
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("settings.taxAudit.errors.incompleteInvoiceData");
    expect(json).toContain("INV-2026-00007");
    expect(json).toContain("settings.taxAudit.fields.buyerZipCode");
  });

  it("falls back to a generic error when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const tree = await render();
    await press(tree, "tax-audit-download");
    expect(JSON.stringify(tree.toJSON())).toContain("settings.taxAudit.errors.exportFailed");
  });
});
