// components/invoices/PdfPreviewEmbed.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PdfPreviewEmbed, pdfViewerSrc, SWAP_AFTER_LOAD_MS } from "@/components/invoices/PdfPreviewEmbed";

jest.mock("@/lib/platform", () => ({
  isWeb: jest.fn(() => true),
}));

const { isWeb } = jest.requireMock("@/lib/platform") as { isWeb: jest.Mock };

function iframes(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType("iframe" as never);
}

describe("PdfPreviewEmbed", () => {
  beforeEach(() => {
    isWeb.mockReturnValue(true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders an iframe on web when src is provided, fitted to the frame width", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <PdfPreviewEmbed src="/api/invoices/inv-1/pdf" title="Invoice PDF" minHeight={400} />
      );
    });

    const [iframe] = iframes(tree!);
    expect(iframe!.props.src).toBe("/api/invoices/inv-1/pdf#view=FitH");
    expect(iframe!.props.title).toBe("Invoice PDF");
    expect(iframe!.props.style.zIndex).toBe(2);
  });

  it("keeps the previous render visible until the new one has loaded (no flicker)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<PdfPreviewEmbed src="blob:a" title="PDF" minHeight={400} />);
    });
    act(() => {
      tree!.update(<PdfPreviewEmbed src="blob:b" title="PDF" minHeight={400} />);
    });

    let frames = iframes(tree!);
    expect(frames.map((f) => f.props.src)).toEqual(["blob:a#view=FitH", "blob:b#view=FitH"]);
    // The new frame renders underneath the visible one until it is ready.
    expect(frames[0]!.props.style.zIndex).toBe(2);
    expect(frames[1]!.props.style.zIndex).toBe(1);
    expect(frames[1]!.props["aria-hidden"]).toBe(true);

    act(() => frames[1]!.props.onLoad());
    // Still the old frame right after `load` — the viewer paints a beat later.
    expect(iframes(tree!)).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(SWAP_AFTER_LOAD_MS);
    });
    frames = iframes(tree!);
    expect(frames.map((f) => f.props.src)).toEqual(["blob:b#view=FitH"]);
    expect(frames[0]!.props.style.zIndex).toBe(2);
  });

  it("swaps anyway after a fallback delay when the browser never fires load", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<PdfPreviewEmbed src="blob:a" title="PDF" minHeight={400} />);
    });
    act(() => {
      tree!.update(<PdfPreviewEmbed src="blob:b" title="PDF" minHeight={400} />);
    });
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    expect(iframes(tree!).map((f) => f.props.src)).toEqual(["blob:b#view=FitH"]);
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
      tree = TestRenderer.create(<PdfPreviewEmbed src="" title="Invoice PDF" minHeight={400} />);
    });

    expect(tree!.toJSON()).toBeNull();
  });

  it("leaves an explicit fragment alone", () => {
    expect(pdfViewerSrc("blob:x#page=2")).toBe("blob:x#page=2");
  });
});
