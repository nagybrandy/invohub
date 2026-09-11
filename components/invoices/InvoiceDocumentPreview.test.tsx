// components/invoices/InvoiceDocumentPreview.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { apiFetch, invoicePdfUrl } from "@/lib/api/client";
import { isWeb } from "@/lib/platform";

jest.mock("@/lib/platform", () => ({
  isWeb: jest.fn(() => true),
}));

jest.mock("@/lib/pdf-preview", () => ({
  sharePdfBlob: jest.fn(),
}));

jest.mock("@/lib/useIsDesktop", () => ({
  useIsDesktop: () => true,
}));

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
  invoicePdfUrl: jest.fn((id: string) => `https://app.test/api/invoices/${id}/pdf`),
}));

jest.mock("@/components/invoices/PdfPreviewEmbed", () => ({
  PdfPreviewEmbed: ({ src, title }: { src: string; title: string }) => {
    const { Text } = require("react-native");
    return <Text testID="pdf-embed">{`${title}|${src}`}</Text>;
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
  return {
    Button: mockUi.Pressable,
    ButtonText: mockUi.Text,
    ButtonSpinner: mockUi.View,
  };
});

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockInvoicePdfUrl = invoicePdfUrl as jest.MockedFunction<typeof invoicePdfUrl>;
const mockIsWeb = isWeb as jest.MockedFunction<typeof isWeb>;

describe("InvoiceDocumentPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsWeb.mockReturnValue(true);
    mockApiFetch.mockResolvedValue({ html: "<html>preview</html>" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["%PDF"], { type: "application/pdf" })),
    }) as unknown as typeof fetch;
    global.URL.createObjectURL = jest.fn(() => "blob:preview-pdf");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("embeds saved invoice PDF via direct API URL in split layout", async () => {
    const invoice = makeInvoice({ id: "inv-42" });
    mockInvoicePdfUrl.mockReturnValue("https://app.test/api/invoices/inv-42/pdf");

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-42" layout="split" />
      );
      await Promise.resolve();
    });

    expect(mockInvoicePdfUrl).toHaveBeenCalledWith("inv-42");
    const embed = tree!.root.findByProps({ testID: "pdf-embed" });
    expect(embed.props.children).toContain("https://app.test/api/invoices/inv-42/pdf");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("loads draft PDF preview from preview API", async () => {
    const invoice = makeInvoice({ id: "draft-preview" });

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} layout="split" />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/invoices/preview/pdf"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    const embed = tree!.root.findByProps({ testID: "pdf-embed" });
    expect(embed.props.children).toContain("blob:preview-pdf");
  });

  it("fetches HTML preview for saved invoices", async () => {
    const invoice = makeInvoice({ id: "inv-99" });

    await act(async () => {
      TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-99" layout="split" />
      );
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/inv-99/preview");
  });

  it("fetches saved PDF bytes on native without using browser object URLs", async () => {
    mockIsWeb.mockReturnValue(false);
    const invoice = makeInvoice({ id: "inv-native" });

    await act(async () => {
      TestRenderer.create(
        <InvoiceDocumentPreview
          invoice={invoice}
          invoiceId="inv-native"
          layout="split"
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/invoices/inv-native/pdf"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });
});
