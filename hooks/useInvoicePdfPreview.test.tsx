// hooks/useInvoicePdfPreview.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  invoicePdfSourceKey,
  PDF_PREVIEW_TIMEOUT_MS,
  useInvoicePdfPreview,
  type InvoicePdfSource,
} from "@/hooks/useInvoicePdfPreview";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/auth-url", () => ({ getAuthBaseUrl: () => "http://localhost:8081" }));

type HookResult = ReturnType<typeof useInvoicePdfPreview>;

let objectUrlCounter = 0;
const revoked: string[] = [];

function pdfResponse(): Response {
  return { ok: true, blob: async () => ({ size: 10 }) } as unknown as Response;
}

function setup(initial: InvoicePdfSource, opts?: { enabled?: boolean; debounceMs?: number }) {
  const ref: { current: HookResult | null } = { current: null };
  function Host({ source }: { source: InvoicePdfSource }) {
    ref.current = useInvoicePdfPreview(source, opts);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Host source={initial} />);
  });
  return {
    ref,
    update(source: InvoicePdfSource) {
      act(() => renderer.update(<Host source={source} />));
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useInvoicePdfPreview", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    objectUrlCounter = 0;
    revoked.length = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => pdfResponse());
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      `blob:pdf-${++objectUrlCounter}`;
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u: string) => {
      revoked.push(u);
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches a saved invoice's real PDF immediately", async () => {
    const { ref } = setup({ kind: "saved", invoiceId: "inv-1" });
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8081/api/invoices/inv-1/pdf",
      expect.objectContaining({ credentials: "include" })
    );
    expect(ref.current?.url).toBe("blob:pdf-1");
    expect(ref.current?.loading).toBe(false);
  });

  it("renders a draft through POST /api/invoices/preview/pdf with the payload", async () => {
    const invoice = makeInvoice({ invoiceNumber: "" });
    setup({ kind: "draft", invoice });
    await flush();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:8081/api/invoices/preview/pdf");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).invoice.clientName).toBe(invoice.clientName);
  });

  it("debounces draft edits: a burst of edits makes ONE request ~700ms after the last one", async () => {
    const invoice = makeInvoice();
    const hook = setup({ kind: "draft", invoice });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    hook.update({ kind: "draft", invoice: { ...invoice, clientName: "A" } });
    await flush(300);
    hook.update({ kind: "draft", invoice: { ...invoice, clientName: "AB" } });
    await flush(300);
    hook.update({ kind: "draft", invoice: { ...invoice, clientName: "ABC" } });
    await flush(699);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).invoice.clientName).toBe("ABC");
  });

  it("keeps the previous render visible while refreshing, and keeps it alive until replaced twice", async () => {
    const invoice = makeInvoice();
    const hook = setup({ kind: "draft", invoice });
    await flush();
    expect(hook.ref.current?.url).toBe("blob:pdf-1");

    hook.update({ kind: "draft", invoice: { ...invoice, notes: "x" } });
    await flush(100);
    expect(hook.ref.current?.loading).toBe(true);
    expect(hook.ref.current?.url).toBe("blob:pdf-1");

    await flush(700);
    expect(hook.ref.current?.url).toBe("blob:pdf-2");
    // pdf-1 still backs the outgoing frame of the double buffer.
    expect(revoked).toEqual([]);

    hook.update({ kind: "draft", invoice: { ...invoice, notes: "y" } });
    await flush(800);
    expect(hook.ref.current?.url).toBe("blob:pdf-3");
    expect(revoked).toEqual(["blob:pdf-1"]);

    hook.unmount();
    expect(revoked).toEqual(["blob:pdf-1", "blob:pdf-2", "blob:pdf-3"]);
  });

  it("does not re-render when only timestamps change", async () => {
    const invoice = makeInvoice();
    const hook = setup({ kind: "draft", invoice });
    await flush();
    hook.update({ kind: "draft", invoice: { ...invoice, updatedAt: "2030-01-01T00:00:00Z" } });
    await flush(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error but keeps the last good render; retry refetches", async () => {
    const invoice = makeInvoice();
    const hook = setup({ kind: "draft", invoice });
    await flush();
    fetchMock.mockImplementationOnce(async () =>
      ({ ok: false, statusText: "Bad", json: async () => ({ error: "Boom" }) }) as unknown as Response
    );
    hook.update({ kind: "draft", invoice: { ...invoice, lineItems: [makeLineItem({ quantity: 9 })] } });
    await flush(800);
    expect(hook.ref.current?.error).toBe("Boom");
    expect(hook.ref.current?.url).toBe("blob:pdf-1");

    act(() => hook.ref.current!.retry());
    await flush(800);
    expect(hook.ref.current?.error).toBeNull();
    expect(hook.ref.current?.url).toBe("blob:pdf-2");
  });

  it("fails with a retryable error instead of spinning forever when a render hangs (INV-11)", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const hook = setup({ kind: "saved", invoiceId: "inv-1" });
    await flush();
    expect(hook.ref.current?.loading).toBe(true);
    await flush(PDF_PREVIEW_TIMEOUT_MS);
    expect(hook.ref.current?.loading).toBe(false);
    expect(hook.ref.current?.error).toBeTruthy();
    act(() => hook.ref.current!.retry());
    await flush();
    expect(hook.ref.current?.url).toBe("blob:pdf-1");
    expect(hook.ref.current?.error).toBeNull();
  });

  it("fetches nothing automatically when disabled (native), but fetchBlob works on demand", async () => {
    const hook = setup({ kind: "saved", invoiceId: "inv-9" }, { enabled: false });
    await flush(2000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hook.ref.current?.loading).toBe(false);
    await act(async () => {
      await hook.ref.current!.fetchBlob();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("source keys ignore timestamps/id but track content", () => {
    const a = makeInvoice();
    expect(invoicePdfSourceKey({ kind: "draft", invoice: a })).toBe(
      invoicePdfSourceKey({ kind: "draft", invoice: { ...a, id: "other", updatedAt: "x" } })
    );
    expect(invoicePdfSourceKey({ kind: "draft", invoice: a })).not.toBe(
      invoicePdfSourceKey({ kind: "draft", invoice: { ...a, clientName: "Other" } })
    );
  });
});
