// components/invoices/PdfPreviewEmbed.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PdfPreviewEmbed } from "@/components/invoices/PdfPreviewEmbed";

jest.mock("@/lib/platform", () => ({
  isWeb: jest.fn(() => true),
}));

const { isWeb } = jest.requireMock("@/lib/platform") as { isWeb: jest.Mock };

describe("PdfPreviewEmbed", () => {
  beforeEach(() => {
    isWeb.mockReturnValue(true);
  });

  it("renders an iframe on web when src is provided", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <PdfPreviewEmbed src="/api/invoices/inv-1/pdf" title="Invoice PDF" minHeight={400} />
      );
    });

    const iframe = tree!.root.findByType("iframe" as never);
    expect(iframe.props.src).toBe("/api/invoices/inv-1/pdf");
    expect(iframe.props.title).toBe("Invoice PDF");
  });

  it("returns null when not on web", () => {
    isWeb.mockReturnValue(false);

    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <PdfPreviewEmbed src="/api/invoices/inv-1/pdf" title="Invoice PDF" minHeight={400} />
      );
    });

    expect(tree!.toJSON()).toBeNull();
  });

  it("returns null without src", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <PdfPreviewEmbed src="" title="Invoice PDF" minHeight={400} />
      );
    });

    expect(tree!.toJSON()).toBeNull();
  });
});
