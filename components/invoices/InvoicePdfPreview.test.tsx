// components/invoices/InvoicePdfPreview.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { InvoicePdfPreview } from "@/components/invoices/InvoicePdfPreview";
import { useInvoicePdfPreview } from "@/hooks/useInvoicePdfPreview";
import { isWeb } from "@/lib/platform";
import { sharePdfBlob } from "@/lib/pdf-preview";

jest.mock("@/lib/platform", () => ({ isWeb: jest.fn(() => true) }));
jest.mock("@/lib/pdf-preview", () => ({ sharePdfBlob: jest.fn() }));
jest.mock("@/lib/api/client", () => ({
  invoicePdfUrl: (id: string) => `https://app.test/api/invoices/${id}/pdf`,
}));
jest.mock("@/hooks/useInvoicePdfPreview", () => ({ useInvoicePdfPreview: jest.fn() }));
jest.mock("@/components/invoices/PdfPreviewEmbed", () => ({
  PdfPreviewEmbed: ({ src }: { src: string }) => {
    const { Text } = require("react-native");
    return <Text testID="pdf-embed">{src}</Text>;
  },
}));
jest.mock("@/components/layout/StateView", () => ({
  StateView: ({ title, onRetry }: { title: string; onRetry: () => void }) => {
    const { Text } = require("react-native");
    return (
      <Text testID="state-view-error" onPress={onRetry}>
        {title}
      </Text>
    );
  },
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return { Button: mockUi.Pressable, ButtonText: mockUi.Text, ButtonSpinner: mockUi.View };
});

const mockHook = useInvoicePdfPreview as jest.MockedFunction<typeof useInvoicePdfPreview>;
const mockIsWeb = isWeb as jest.MockedFunction<typeof isWeb>;

function hookState(overrides: Partial<ReturnType<typeof useInvoicePdfPreview>> = {}) {
  return {
    url: null,
    loading: false,
    error: null,
    retry: jest.fn(),
    fetchBlob: jest.fn(async () => new Blob(["%PDF"])),
    ...overrides,
  };
}

function render(el: React.ReactElement) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(el);
  });
  return tree!;
}

const byTestId = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props.testID === id && typeof n.type !== "string");

describe("InvoicePdfPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsWeb.mockReturnValue(true);
    delete (navigator as { pdfViewerEnabled?: boolean }).pdfViewerEnabled;
  });

  it("shows a loader before the first render", () => {
    mockHook.mockReturnValue(hookState({ loading: true }));
    const tree = render(<InvoicePdfPreview source={{ kind: "saved", invoiceId: "inv-1" }} />);
    expect(byTestId(tree, "invoice-pdf-preview-loading").length).toBeGreaterThan(0);
    expect(byTestId(tree, "pdf-embed")).toHaveLength(0);
  });

  it("embeds the rendered PDF — the only preview, no HTML variant", () => {
    mockHook.mockReturnValue(hookState({ url: "blob:one" }));
    const tree = render(<InvoicePdfPreview source={{ kind: "saved", invoiceId: "inv-1" }} />);
    const embed = byTestId(tree, "pdf-embed")[0]!;
    expect(embed.props.children).toBe("blob:one");
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/HTML/);
    expect(mockHook).toHaveBeenCalledWith({ kind: "saved", invoiceId: "inv-1" }, { enabled: true });
  });

  it("keeps the last render and shows a subtle refreshing indicator while a new one loads", () => {
    mockHook.mockReturnValue(hookState({ url: "blob:one", loading: true }));
    const tree = render(<InvoicePdfPreview source={{ kind: "draft", invoice: makeInvoice() }} />);
    expect(byTestId(tree, "pdf-embed")).toHaveLength(1);
    expect(byTestId(tree, "invoice-pdf-preview-refreshing").length).toBeGreaterThan(0);
    expect(byTestId(tree, "invoice-pdf-preview-loading")).toHaveLength(0);
  });

  it("shows a retryable error when the first render fails", () => {
    const state = hookState({ error: "Boom" });
    mockHook.mockReturnValue(state);
    const tree = render(<InvoicePdfPreview source={{ kind: "saved", invoiceId: "inv-1" }} />);
    const error = byTestId(tree, "state-view-error")[0]!;
    act(() => error.props.onPress());
    expect(state.retry).toHaveBeenCalled();
  });

  it("keeps the last good render when a refresh fails, with an inline retry", () => {
    mockHook.mockReturnValue(hookState({ url: "blob:one", error: "Boom" }));
    const tree = render(<InvoicePdfPreview source={{ kind: "draft", invoice: makeInvoice() }} />);
    expect(byTestId(tree, "pdf-embed")).toHaveLength(1);
    expect(byTestId(tree, "invoice-pdf-preview-refresh-error").length).toBeGreaterThan(0);
  });

  it("opens a saved invoice's real PDF URL in a new tab on web", () => {
    const open = jest.fn();
    (global as unknown as { window: { open: jest.Mock } }).window.open = open;
    mockHook.mockReturnValue(hookState({ url: "blob:one" }));
    const tree = render(
      <InvoicePdfPreview source={{ kind: "saved", invoiceId: "inv-1" }} openTestID="open-btn" />
    );
    act(() => byTestId(tree, "open-btn")[0]!.props.onPress());
    expect(open).toHaveBeenCalledWith("https://app.test/api/invoices/inv-1/pdf", "_blank", "noopener,noreferrer");
  });

  it("on native: fetches nothing up front, explains, and hands the PDF to the OS viewer on press", async () => {
    mockIsWeb.mockReturnValue(false);
    const state = hookState();
    mockHook.mockReturnValue(state);
    const tree = render(
      <InvoicePdfPreview source={{ kind: "draft", invoice: makeInvoice() }} filename="draft.pdf" openTestID="open-btn" />
    );
    expect(mockHook).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    expect(byTestId(tree, "invoice-pdf-preview-native").length).toBeGreaterThan(0);
    await act(async () => {
      await byTestId(tree, "open-btn")[0]!.props.onPress();
    });
    expect(state.fetchBlob).toHaveBeenCalled();
    expect(sharePdfBlob).toHaveBeenCalledWith(expect.anything(), "draft.pdf");
  });

  it("on a mobile browser without an inline PDF viewer: no embed, opens the rendered draft in the browser", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { value: false, configurable: true });
    const open = jest.fn();
    (global as unknown as { window: { open: jest.Mock } }).window.open = open;
    mockHook.mockReturnValue(hookState({ url: "blob:draft" }));
    const tree = render(
      <InvoicePdfPreview source={{ kind: "draft", invoice: makeInvoice() }} openTestID="open-btn" />
    );
    expect(byTestId(tree, "pdf-embed")).toHaveLength(0);
    expect(byTestId(tree, "invoice-pdf-preview-native").length).toBeGreaterThan(0);
    act(() => byTestId(tree, "open-btn")[0]!.props.onPress());
    expect(open).toHaveBeenCalledWith("blob:draft", "_blank", "noopener,noreferrer");
    expect(sharePdfBlob).not.toHaveBeenCalled();
  });
});
