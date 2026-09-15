// components/invoices/InvoiceDocumentPreview.test.tsx
import * as fs from "node:fs";
import * as path from "node:path";
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { apiFetch } from "@/lib/api/client";
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

jest.mock("@/lib/auth-url", () => ({
  getAuthBaseUrl: () => "https://app.test",
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

  it("fetches saved invoice PDF with credentials and embeds a blob URL", async () => {
    const invoice = makeInvoice({ id: "inv-42" });

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-42" layout="split" />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/invoices/inv-42/pdf"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    const embed = tree!.root.findByProps({ testID: "pdf-embed" });
    expect(embed.props.children).toContain("blob:preview-pdf");
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

  it("single layout: renders one view (no HTML|PDF tab pair) and never eagerly fetches the PDF", async () => {
    const invoice = makeInvoice({ id: "inv-single" });

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-single" layout="single" />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    // Only the HTML preview endpoint is hit — no eager PDF fetch.
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/inv-single/preview");
    expect(global.fetch).not.toHaveBeenCalled();
    // A single preview view, not an HTML|PDF tab pair.
    expect(tree!.root.findAllByType("iframe" as never)).toHaveLength(1);
    expect(() => tree!.root.findByProps({ testID: "pdf-embed" })).toThrow();
  });

  it("single layout: shows a retryable error after 10s instead of spinning forever (INV-11)", async () => {
    jest.useFakeTimers();
    // Never resolves — simulates the eternally-spinning panel.
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const invoice = makeInvoice({ id: "inv-stuck" });

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-stuck" layout="single" />
      );
    });

    expect(() => tree!.root.findByProps({ testID: "state-view-error" })).toThrow();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(tree!.root.findByProps({ testID: "state-view-error" })).toBeTruthy();
    jest.useRealTimers();
  });

  it("single layout: the download-PDF button fetches on demand, not on mount", async () => {
    const invoice = makeInvoice({ id: "inv-single-2" });

    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview invoice={invoice} invoiceId="inv-single-2" layout="single" />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();

    (window as unknown as { open: jest.Mock }).open = jest.fn();
    const downloadButton = tree!.root.findByProps({ testID: "invoice-preview-download-pdf" });
    await act(async () => {
      await downloadButton.props.onPress?.();
    });

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("inv-single-2/pdf"),
      "_blank",
      "noopener,noreferrer"
    );
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

  it("renders the unsaved-draft preview with no company prop — no crash, no extra fetch", async () => {
    const invoice = makeInvoice({ id: "draft-no-company" });

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(<InvoiceDocumentPreview invoice={invoice} layout="tabs" />);
      await Promise.resolve();
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(tree!.root.findAllByType("iframe" as never).length).toBeGreaterThan(0);
  });

  it("passes an optional company prop into the unsaved-draft HTML preview", async () => {
    const invoice = makeInvoice({ id: "draft-with-company" });

    let tree: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => {
      tree = TestRenderer.create(
        <InvoiceDocumentPreview
          invoice={invoice}
          company={{ name: "Kovács Bt.", taxNumber: "11111111-1-11" }}
          layout="tabs"
        />
      );
      await Promise.resolve();
    });

    const iframe = tree!.root.findAllByType("iframe" as never)[0] as unknown as {
      props: { srcDoc: string };
    };
    expect(iframe.props.srcDoc).toContain("Kovács Bt.");
  });
});

describe("InvoiceDocumentPreview i18n chrome coverage", () => {
  it("has no hardcoded English chrome strings — every preview-chrome string comes from an invoices.preview.* key", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "InvoiceDocumentPreview.tsx"),
      "utf8"
    );
    for (const literal of [
      '"Document preview"',
      '"Open PDF in browser"',
      "HTML preview is available on web.",
      "PDF preview is available on web",
      "Failed to load HTML preview.",
      "Failed to load PDF preview.",
    ]) {
      expect(source).not.toContain(literal);
    }
  });
});
