// __tests__/screens/invoice-edit.test.tsx
// The edit route's only job is: read `id`, fetch the invoice, and hand it to
// <InvoiceComposer mode="edit">, which is otherwise IDENTICAL to the one
// app/(app)/invoices/new.tsx renders (spec §2.7, E1) — the shared
// component's own behaviour (steps, validation, save branches, the
// finalized-invoice read-only branch) is covered by
// components/invoices/composer/useInvoiceComposer.test.tsx and
// composer-logic.test.ts, and its full render is exercised by the
// app-pages.smoke.test.tsx screen-render suite. Mocking InvoiceComposer
// here keeps this file about the route wrapper, not a second copy of the
// composer's own test surface.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("@/lib/routing/route-param", () => ({
  useRouteParam: () => "inv-1",
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockComposerCalls: Array<{ mode: string; invoice: unknown }> = [];
jest.mock("@/components/invoices/composer/InvoiceComposer", () => ({
  InvoiceComposer: (props: { mode: string; invoice?: unknown }) => {
    mockComposerCalls.push({ mode: props.mode, invoice: props.invoice });
    const { Text } = require("react-native");
    return <Text testID="composer-stub">{`mode:${props.mode}`}</Text>;
  },
}));

async function renderScreen() {
  const EditInvoiceScreen = require("@/app/(app)/invoices/[id]/edit").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<EditInvoiceScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree!;
}

describe("EditInvoiceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComposerCalls.length = 0;
  });

  it("shows a loading state before the invoice has loaded", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockApiFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));

    const EditInvoiceScreen = require("@/app/(app)/invoices/[id]/edit").default;
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<EditInvoiceScreen />);
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain("composer-stub");

    await act(async () => {
      resolveFetch({ invoice: makeInvoice({ id: "inv-1" }) });
      await Promise.resolve();
    });
  });

  it("fetches the invoice by route id and renders the composer in edit mode", async () => {
    const invoice = makeInvoice({ id: "inv-1", clientName: "Acme Kft.", status: "draft" });
    mockApiFetch.mockResolvedValue({ invoice });

    await renderScreen();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/inv-1");
    expect(mockComposerCalls).toHaveLength(1);
    expect(mockComposerCalls[0].mode).toBe("edit");
    expect(mockComposerCalls[0].invoice).toEqual(invoice);
  });

  it("passes a finalized invoice through unchanged — read-only is the composer's own concern", async () => {
    const invoice = makeInvoice({ id: "inv-1", status: "sent" });
    mockApiFetch.mockResolvedValue({ invoice });

    await renderScreen();

    expect(mockComposerCalls[0].invoice).toMatchObject({ status: "sent" });
  });
});
