// components/invoices/composer/useInvoiceComposer.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import {
  useInvoiceComposer,
  type UseInvoiceComposerOptions,
} from "@/components/invoices/composer/useInvoiceComposer";
import { apiFetch, ApiError } from "@/lib/api/client";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Client } from "@/lib/clients/service";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
  // The real ApiError has no dependencies of its own — keep it real so
  // `e instanceof ApiError` in useInvoiceComposer.ts's save() still works
  // against an error built with THIS (mocked) module's export.
  ApiError: jest.requireActual("@/lib/api/client").ApiError,
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockRouterReplace = router.replace as jest.Mock;

const CLIENT: Client = {
  id: "client-1",
  userId: "u1",
  name: "Tech Solutions Kft.",
  email: "info@techsolutions.hu",
  taxNumber: "12345678-1-23",
  country: "Magyarország",
  zipCode: "1011",
  city: "Budapest",
  address: "Fő utca 1.",
  createdAt: "",
  updatedAt: "",
};

function jsonResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}

function setupApiFetch(overrides: Partial<Record<string, unknown>> = {}) {
  mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (path === "/api/clients") return jsonResponse({ clients: [CLIENT] });
    if (path === "/api/products") return jsonResponse({ products: [] });
    if (path === "/api/companies") {
      return jsonResponse({
        company: overrides.company ?? {
          id: "c1",
          userId: "u1",
          name: "Demo Kft.",
          vatExempt: false,
          createdAt: "",
          updatedAt: "",
        },
      });
    }
    if (path.startsWith("/api/exchange-rates?")) {
      // Deliberately unmocked by default (rejects) so tests that aren't
      // about the MNB auto-fetch never depend on it succeeding — see the
      // dedicated "MNB exchange rate auto-fetch" describe block below for
      // success/failure coverage.
      return Promise.reject(new Error("exchange rate not mocked in this test"));
    }
    if (path.startsWith("/api/invoices?")) {
      return jsonResponse({
        invoices: [],
        total: 0,
        limit: 20,
        offset: 0,
        stats: { count: 0, thisMonthCount: 0, monthlyTotal: 0 },
      });
    }
    if (path === "/api/invoices" && method === "POST") {
      const body = JSON.parse(init!.body as string);
      return jsonResponse({ invoice: { ...body, invoiceNumber: "INV-2026-100" } });
    }
    if (path.match(/^\/api\/invoices\/[^/]+$/) && method === "PATCH") {
      const body = JSON.parse(init!.body as string);
      return jsonResponse({ invoice: body });
    }
    if (path.match(/^\/api\/invoices\/[^/]+\/send$/)) {
      return jsonResponse({});
    }
    return jsonResponse({});
  });
}

async function renderComposer(options: UseInvoiceComposerOptions) {
  const ref: { current: ReturnType<typeof useInvoiceComposer> | null } = { current: null };

  function HookHost() {
    ref.current = useInvoiceComposer(options);
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return ref;
}

describe("useInvoiceComposer", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockRouterReplace.mockReset();
    setupApiFetch();
  });

  it("seeds focusField from initialFocusField (AC6.3)", async () => {
    const ref = await renderComposer({ mode: "create", initialFocusField: "exchangeRate" });
    expect(ref.current!.focusField).toBe("exchangeRate");
  });

  it("starts with focusField null when no initialFocusField is given (AC6.3)", async () => {
    const ref = await renderComposer({ mode: "create" });
    expect(ref.current!.focusField).toBeNull();
  });

  it("selecting a saved partner never turns e-mail sending on (INV-2)", async () => {
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.handleSelectClient(CLIENT);
    });

    expect(ref.current!.emailOnSend).toBe(false);
    expect(ref.current!.clientName).toBe("Tech Solutions Kft.");
    expect(ref.current!.clientId).toBe("client-1");
  });

  it("has no saved-at time until a save actually succeeds (INV-1)", async () => {
    const ref = await renderComposer({ mode: "create" });

    act(() => {
      ref.current!.setClientName("Acme Kft.");
    });
    expect(ref.current!.savedAt).toBeNull();
    expect(ref.current!.isDirty).toBe(true);
  });

  it("draft save sets savedAt and does not navigate away", async () => {
    const ref = await renderComposer({ mode: "create" });

    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    await act(async () => {
      await ref.current!.save("draft");
    });

    expect(ref.current!.savedAt).not.toBeNull();
    expect(ref.current!.isDirty).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.status).toBe("draft");
  });

  it("'finalize' saves status unpaid and never calls the send endpoint (INV-15)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setClientZip("1011");
      ref.current!.setClientCity("Budapest");
      ref.current!.setClientAddress("Fő utca 1.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    await act(async () => {
      await ref.current!.save("finalize");
    });

    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.status).toBe("unpaid");
    expect(mockApiFetch.mock.calls.some(([path]) => String(path).endsWith("/send"))).toBe(false);
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining(String(body.id))
    );
  });

  it("'finalizeAndSend' saves status sent and calls the send endpoint (INV-15)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setClientEmail("acme@example.com");
      ref.current!.setEmailOnSend(true);
      ref.current!.setClientZip("1011");
      ref.current!.setClientCity("Budapest");
      ref.current!.setClientAddress("Fő utca 1.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    await act(async () => {
      await ref.current!.save("finalizeAndSend");
    });

    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.status).toBe("sent");
    expect(mockApiFetch.mock.calls.some(([path]) => String(path).endsWith("/send"))).toBe(true);
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it("never submits to NAV from the client — finalization submits server-side (no opt-in toggle)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setClientEmail("acme@example.com");
      ref.current!.setEmailOnSend(true);
      ref.current!.setClientZip("1011");
      ref.current!.setClientCity("Budapest");
      ref.current!.setClientAddress("Fő utca 1.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    await act(async () => {
      await ref.current!.save("finalizeAndSend");
    });
    await act(async () => {
      await ref.current!.save("finalize");
    });

    expect(mockApiFetch.mock.calls.some(([path]) => path === "/api/nav/submit")).toBe(false);
    expect("navEnabled" in ref.current!).toBe(false);
  });

  it("blocks 'finalize' and points at the partner step with the address panel open when the buyer address is incomplete (Áfa tv. 169. § e)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("finalize");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.step).toBe("partner");
    expect(ref.current!.errors.buyerAddress).toBeTruthy();
    expect(ref.current!.showClientDetails).toBe(true);
    expect(ref.current!.focusField).toBe("clientZip");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/invoices",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("allows 'draft' saves with no buyer address at all", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeTruthy();
    expect(ref.current!.errors.buyerAddress).toBeFalsy();
  });

  it("never requires a buyer address for a proforma (díjbekérő)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setDocumentType("proforma");
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("finalize");
    });

    expect(result).toBeTruthy();
    expect(ref.current!.errors.buyerAddress).toBeFalsy();
  });

  it("blocks save and points at the partner step when the partner name is empty (INV-4)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.step).toBe("partner");
    expect(ref.current!.errors.partner).toBeTruthy();
    expect(ref.current!.focusField).toBe("clientName");
  });

  it("blocks save and points at the items step when no line item has a description (INV-4)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.step).toBe("items");
    expect(ref.current!.errors.lineItems).toBeTruthy();
  });

  it("blocks save when the due date is before the issue date (INV-8)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
      ref.current!.setIssueDate("2026-09-20");
      ref.current!.setDueDate("2026-09-10");
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.errors.dueDate).toBeTruthy();
  });

  it("applies company defaults (currency, payment method, bank account, VAT-exempt line) once loaded", async () => {
    setupApiFetch({
      company: {
        id: "c1",
        userId: "u1",
        name: "Demo Kft.",
        vatExempt: true,
        bankAccount: "12345678-12345678-12345678",
        defaultCurrency: "EUR",
        defaultPaymentMethod: "cash",
        defaultPaymentTermDays: 15,
        createdAt: "",
        updatedAt: "",
      },
    });

    const ref = await renderComposer({ mode: "create" });

    expect(ref.current!.currency).toBe("EUR");
    expect(ref.current!.paymentMethod).toBe("cash");
    expect(ref.current!.bankAccount).toBe("12345678-12345678-12345678");
    expect(ref.current!.deadlineDays).toBe(15);
    expect(ref.current!.lineItems[0].vatCategory).toBe("AAM");
  });

  it("companyProfileIncomplete is true when the loaded company is missing required fields (default fixture: no taxNumber/address)", async () => {
    const ref = await renderComposer({ mode: "create" });
    expect(ref.current!.companyProfileIncomplete).toBe(true);
  });

  it("companyProfileIncomplete is false once every required field is present", async () => {
    setupApiFetch({
      company: {
        id: "c1",
        userId: "u1",
        name: "Demo Kft.",
        taxNumber: "12345678-1-23",
        zipCode: "1011",
        city: "Budapest",
        address: "Fő utca 1.",
        vatExempt: false,
        createdAt: "",
        updatedAt: "",
      },
    });
    const ref = await renderComposer({ mode: "create" });
    expect(ref.current!.companyProfileIncomplete).toBe(false);
  });

  it("edit mode seeds state from the loaded invoice and does not apply company defaults", async () => {
    const invoice = makeInvoice({
      id: "inv-42",
      clientName: "Existing Kft.",
      currency: "EUR",
      paymentMethod: "card",
    });

    const ref = await renderComposer({ mode: "edit", invoice });

    expect(ref.current!.clientName).toBe("Existing Kft.");
    expect(ref.current!.currency).toBe("EUR");
    expect(ref.current!.paymentMethod).toBe("card");
    expect(ref.current!.documentTabsDisabled).toBe(true);
  });

  // AC9: edit mode initializes fulfillmentDate from the invoice, falling
  // back to issueDate only when the invoice has none.
  it("edit mode initializes fulfillmentDate from invoice.fulfillmentDate when set (AC9)", async () => {
    const invoice = makeInvoice({
      id: "inv-43",
      issueDate: "2026-09-01",
      fulfillmentDate: "2026-09-12",
    });

    const ref = await renderComposer({ mode: "edit", invoice });

    expect(ref.current!.fulfillmentDate).toBe("2026-09-12");
  });

  it("edit mode falls back to issueDate when the invoice has no fulfillmentDate (AC9)", async () => {
    const invoice = makeInvoice({
      id: "inv-44",
      issueDate: "2026-09-01",
      fulfillmentDate: undefined,
    });

    const ref = await renderComposer({ mode: "edit", invoice });

    expect(ref.current!.fulfillmentDate).toBe("2026-09-01");
  });

  it("changing fulfillmentDate marks the composer dirty (AC9)", async () => {
    const ref = await renderComposer({ mode: "create" });
    expect(ref.current!.isDirty).toBe(false);

    act(() => {
      ref.current!.setFulfillmentDate("2026-09-12");
    });

    expect(ref.current!.fulfillmentDate).toBe("2026-09-12");
    expect(ref.current!.isDirty).toBe(true);
  });

  // AC8: the save payload and the live-preview draftInvoice both carry
  // fulfillmentDate (trimmed; undefined when blank).
  it("save payload and draftInvoice carry the trimmed fulfillmentDate (AC8)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
      ref.current!.setFulfillmentDate("  2026-09-12  ");
    });

    expect(ref.current!.draftInvoice.fulfillmentDate).toBe("2026-09-12");

    await act(async () => {
      await ref.current!.save("draft");
    });

    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.fulfillmentDate).toBe("2026-09-12");
  });

  it("save payload and draftInvoice omit fulfillmentDate when blank (AC8)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás", unitPrice: 1000 })]);
      ref.current!.setFulfillmentDate("   ");
    });

    expect(ref.current!.draftInvoice.fulfillmentDate).toBeUndefined();

    await act(async () => {
      await ref.current!.save("draft");
    });

    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.fulfillmentDate).toBeUndefined();
  });

  it("clears the partner error banner as soon as a name is typed (spec §2.6)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
    });
    await act(async () => {
      await ref.current!.save("draft");
    });
    expect(ref.current!.errors.partner).toBeTruthy();

    act(() => {
      ref.current!.setClientName("Acme Kft.");
    });
    expect(ref.current!.errors.partner).toBeFalsy();
  });

  it("clears the line-items error banner as soon as a description is added (spec §2.6)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
    });
    await act(async () => {
      await ref.current!.save("draft");
    });
    expect(ref.current!.errors.lineItems).toBeTruthy();

    act(() => {
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
    });
    expect(ref.current!.errors.lineItems).toBeFalsy();
  });

  it("clears the due-date error banner once the date is fixed (INV-8)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
      ref.current!.setIssueDate("2026-09-20");
      ref.current!.setDueDate("2026-09-10");
    });
    await act(async () => {
      await ref.current!.save("draft");
    });
    expect(ref.current!.errors.dueDate).toBeTruthy();

    act(() => {
      ref.current!.setDueDate("2026-09-25");
    });
    expect(ref.current!.errors.dueDate).toBeFalsy();
  });

  it("blocks save for a non-HUF invoice with an empty exchange rate (AC13)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
      ref.current!.setCurrency("EUR");
    });

    let result;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.errors.partner).toBeTruthy();
    expect(ref.current!.step).toBe("partner");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      "/api/invoices",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows a translated companyProfileIncomplete message (not the raw English API error) when finalize is refused server-side", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      // A complete buyer address, so the client-side buyer-address gate
      // (Áfa tv. 169. § e) passes and the save actually reaches the server.
      ref.current!.setClientZip("1011");
      ref.current!.setClientCity("Budapest");
      ref.current!.setClientAddress("Fő utca 1.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
    });

    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (path === "/api/invoices" && method === "POST") {
        return Promise.reject(
          new ApiError("Company profile is incomplete.", 422, "companyProfileIncomplete")
        );
      }
      return jsonResponse({});
    });

    let result;
    await act(async () => {
      result = await ref.current!.save("finalize");
    });

    expect(result).toBeUndefined();
    expect(ref.current!.saveError).toBe("invoices.composer.companyProfileIncomplete");
  });

  it("saves a non-HUF invoice once a valid exchange rate is entered (AC13)", async () => {
    const ref = await renderComposer({ mode: "create" });
    act(() => {
      ref.current!.setClientName("Acme Kft.");
      ref.current!.setLineItems([makeLineItem({ description: "Tanácsadás" })]);
      ref.current!.setCurrency("EUR");
      ref.current!.setExchangeRate("390,5");
    });

    let result;
    await act(async () => {
      result = await ref.current!.save("draft");
    });

    expect(result).toBeTruthy();
    expect(ref.current!.errors.partner).toBeFalsy();
    // Regression: a comma-decimal rate must reach the saved payload as the
    // parsed number (390.5), never NaN/undefined — Number("390,5") is NaN,
    // which JSON.stringify silently drops to null.
    const invoiceCall = mockApiFetch.mock.calls.find(([path]) => path === "/api/invoices");
    const body = JSON.parse((invoiceCall![1] as RequestInit).body as string);
    expect(body.exchangeRate).toBe(390.5);
  });

  it("selects the client from ?clientId= on mount in create mode", async () => {
    const ref = await renderComposer({ mode: "create", initialClientId: "client-1" });
    expect(ref.current!.clientName).toBe("Tech Solutions Kft.");
    expect(ref.current!.clientId).toBe("client-1");
  });
});

// Owner request: "az árfolyamot mindig valami külső helyről kérje le, mint
// a számlázz.hu" — the composer auto-fetches the MNB rate instead of
// requiring the user to type it. These tests own that surface end to end;
// the main describe block above deliberately rejects /api/exchange-rates by
// default so it stays independent of this behaviour.
describe("useInvoiceComposer — MNB exchange rate auto-fetch", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockRouterReplace.mockReset();
    setupApiFetch();
  });

  function mockExchangeRateSuccess(rate: number, rateDate: string) {
    mockApiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/exchange-rates?")) {
        return jsonResponse({ currency: "EUR", rate, rateDate, source: "MNB" });
      }
      // Fall back to the shared setup for everything else.
      const method = init?.method ?? "GET";
      if (path === "/api/clients") return jsonResponse({ clients: [CLIENT] });
      if (path === "/api/products") return jsonResponse({ products: [] });
      if (path === "/api/companies") {
        return jsonResponse({
          company: { id: "c1", userId: "u1", name: "Demo Kft.", vatExempt: false, createdAt: "", updatedAt: "" },
        });
      }
      if (path.startsWith("/api/invoices?")) {
        return jsonResponse({
          invoices: [],
          total: 0,
          limit: 20,
          offset: 0,
          stats: { count: 0, thisMonthCount: 0, monthlyTotal: 0 },
        });
      }
      if (path === "/api/invoices" && method === "POST") {
        const body = JSON.parse(init!.body as string);
        return jsonResponse({ invoice: { ...body, invoiceNumber: "INV-2026-100" } });
      }
      return jsonResponse({});
    });
  }

  it("fetches and fills the rate as soon as the currency changes away from HUF", async () => {
    mockExchangeRateSuccess(397.5, "2026-09-22");
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ref.current!.exchangeRate).toBe("397.5");
    expect(ref.current!.exchangeRateSource).toBe("mnb");
    expect(ref.current!.exchangeRateAsOf).toBe("2026-09-22");
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/exchange-rates?currency=EUR&date=")
    );
  });

  it("re-fetches when the fulfillment date changes for an already-non-HUF invoice", async () => {
    mockExchangeRateSuccess(397.5, "2026-09-22");
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });
    mockApiFetch.mockClear();
    mockExchangeRateSuccess(396.8, "2026-09-18");

    await act(async () => {
      ref.current!.setFulfillmentDate("2026-09-18");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ref.current!.exchangeRate).toBe("396.8");
    expect(ref.current!.exchangeRateAsOf).toBe("2026-09-18");
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2026-09-18")
    );
  });

  it("fetches for the issue date when the fulfillment date is cleared (Áfa tv. 80. § fallback)", async () => {
    mockExchangeRateSuccess(397.5, "2026-09-22");
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setIssueDate("2026-09-20");
      ref.current!.setFulfillmentDate("");
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2026-09-20")
    );
  });

  it("never overwrites a manually-typed rate with a fetch response, and marks it as manual", async () => {
    mockExchangeRateSuccess(397.5, "2026-09-22");
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      ref.current!.setExchangeRate("400");
    });

    expect(ref.current!.exchangeRate).toBe("400");
    expect(ref.current!.exchangeRateSource).toBe("manual");
  });

  it("shows a Hungarian error and stops loading when the fetch fails", async () => {
    // Default setupApiFetch() rejects /api/exchange-rates.
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ref.current!.exchangeRateFetchError).toBeTruthy();
    expect(ref.current!.exchangeRateLoading).toBe(false);
    expect(ref.current!.exchangeRateSource).not.toBe("mnb");
  });

  it("keeps a manually-typed rate even when a later fetch (triggered by a date change) fails", async () => {
    // Default setupApiFetch() rejects /api/exchange-rates.
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ref.current!.exchangeRateFetchError).toBeTruthy();

    act(() => {
      ref.current!.setExchangeRate("400");
    });
    expect(ref.current!.exchangeRateFetchError).toBeNull();

    await act(async () => {
      ref.current!.setFulfillmentDate("2026-09-18");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ref.current!.exchangeRate).toBe("400");
    expect(ref.current!.exchangeRateFetchError).toBeTruthy();
    expect(ref.current!.exchangeRateLoading).toBe(false);
  });

  it("clears the source/caption when currency switches back to HUF", async () => {
    mockExchangeRateSuccess(397.5, "2026-09-22");
    const ref = await renderComposer({ mode: "create" });

    await act(async () => {
      ref.current!.setCurrency("EUR");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ref.current!.exchangeRateSource).toBe("mnb");

    act(() => {
      ref.current!.setCurrency("HUF");
    });

    expect(ref.current!.exchangeRateSource).toBeNull();
  });

  it("does not overwrite an already-valid manual rate when opening the edit screen (no surprise fetch on mount)", async () => {
    mockExchangeRateSuccess(999, "2026-09-22"); // would be an obvious tell if this got applied
    const invoice = makeInvoice({
      id: "inv-1",
      currency: "EUR",
      exchangeRate: 390.5,
      status: "draft",
    });

    const ref = await renderComposer({ mode: "edit", invoice });

    expect(ref.current!.exchangeRate).toBe("390.5");
    expect(ref.current!.exchangeRateSource).toBe("manual");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/exchange-rates?")
    );
  });
});
