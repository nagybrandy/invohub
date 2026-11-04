// components/invoices/composer/CopyFromInvoice.test.tsx
// "Másolás korábbi számlából": picking an invoice calls the existing duplicate
// endpoint and replaces the page with the new draft's edit page.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/layout/AnchoredPopover", () => ({
  MENU_PANEL_CLASS: "",
  AnchoredPopover: ({ open, anchor, children }: { open: boolean; anchor: React.ReactNode; children: React.ReactNode }) => {
    const { View } = require("react-native");
    return (
      <View>
        {anchor}
        {open ? children : null}
      </View>
    );
  },
}));
const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

import { CopyFromInvoice } from "@/components/invoices/composer/CopyFromInvoice";

const t = (key: string) => key;

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === "function");
}

describe("CopyFromInvoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the offered invoices after opening, and duplicates the picked one", async () => {
    mockApiFetch.mockResolvedValue({ invoice: makeInvoice({ id: "new-draft" }) });
    const invoices = [makeInvoice({ id: "a" }), makeInvoice({ id: "b", invoiceNumber: "INV-2026-002" })];
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<CopyFromInvoice invoices={invoices} t={t} />);
    });
    expect(byTestID(tree, "composer-copy-option-a")).toHaveLength(0);

    await act(async () => {
      byTestID(tree, "composer-copy-trigger")[0].props.onPress();
    });
    expect(byTestID(tree, "composer-copy-option-a").length).toBeGreaterThan(0);
    expect(byTestID(tree, "composer-copy-option-b").length).toBeGreaterThan(0);

    await act(async () => {
      byTestID(tree, "composer-copy-option-b")[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices/b/duplicate", { method: "POST" });
    expect(mockReplace).toHaveBeenCalledWith("/invoices/new-draft/edit");
  });

  it("shows the failure message and does not navigate when duplicating fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("boom"));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<CopyFromInvoice invoices={[makeInvoice({ id: "a" })]} t={t} />);
    });
    await act(async () => {
      byTestID(tree, "composer-copy-trigger")[0].props.onPress();
    });
    await act(async () => {
      byTestID(tree, "composer-copy-option-a")[0].props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("composer.copyFailed");
  });
});
