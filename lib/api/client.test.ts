// lib/api/client.test.ts
// ApiError must carry a machine-readable `code` and the full parsed body
// (not just `error`/`statusText`) so callers can map a 400/409 `code` to a
// translated message, or read fields like `invoice` off a 409 body — see
// app/(app)/invoices/[id]/index.tsx's handleConvert / runAction.
import { apiFetch, ApiError } from "@/lib/api/client";

jest.mock("@/lib/auth-url", () => ({
  getAuthBaseUrl: () => "http://localhost:8081",
}));

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 400 ? "Bad Request" : status === 409 ? "Conflict" : "",
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("apiFetch / ApiError", () => {
  it("carries the response's `code` and full body on a 400", async () => {
    mockFetchOnce(400, { code: "notProforma" });

    await expect(apiFetch("/api/invoices/1/convert", { method: "POST" })).rejects.toMatchObject({
      status: 400,
      code: "notProforma",
      body: { code: "notProforma" },
    });
  });

  it("carries the existing invoice in the body on a 409", async () => {
    const existingInvoice = { id: "inv-2", invoiceNumber: "INV-2026-002" };
    mockFetchOnce(409, { code: "alreadyConverted", invoice: existingInvoice });

    try {
      await apiFetch("/api/invoices/1/convert", { method: "POST" });
      throw new Error("expected apiFetch to reject");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.status).toBe(409);
      expect(err.code).toBe("alreadyConverted");
      expect((err.body as { invoice?: unknown }).invoice).toEqual(existingInvoice);
    }
  });

  it("falls back to `error` for the message and leaves `code` undefined when the body has none", async () => {
    mockFetchOnce(400, { error: "Invoice is already cancelled." });

    try {
      await apiFetch("/api/invoices/1/storno", { method: "POST" });
      throw new Error("expected apiFetch to reject");
    } catch (e) {
      const err = e as ApiError;
      expect(err.message).toBe("Invoice is already cancelled.");
      expect(err.code).toBeUndefined();
    }
  });

  it("falls back to statusText when the body has neither `error` nor is parseable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    }) as unknown as typeof fetch;

    await expect(apiFetch("/api/invoices/1")).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
      code: undefined,
    });
  });

  it("resolves with the parsed body on success", async () => {
    mockFetchOnce(201, { invoice: { id: "inv-3" } });
    await expect(apiFetch("/api/invoices/1/convert", { method: "POST" })).resolves.toEqual({
      invoice: { id: "inv-3" },
    });
  });
});
