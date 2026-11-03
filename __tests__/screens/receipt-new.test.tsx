// __tests__/screens/receipt-new.test.tsx
// Új nyugta uses the composer's one-page skeleton (redesign 2026-11) and keeps
// its behaviour: no customer name, no number (the server assigns it), currency
// / language / payment method / VAT like invoices.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("react-native-qrcode-svg", () => () => null);
jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: null }),
}));
const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props?.testID === id && typeof n.type !== "string");
}
function receiptCalls() {
  return mockApiFetch.mock.calls.filter(([url]) => url === "/api/receipts");
}
function allText(tree: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

async function renderScreen() {
  const Screen = require("@/app/(app)/receipts/new").default;
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<Screen />);
    await Promise.resolve();
  });
  return tree!;
}

describe("NewReceiptScreen — one-page skeleton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the shared composer page with the bottom bar and no preview button", async () => {
    const tree = await renderScreen();
    expect(byTestID(tree, "composer-page").length).toBeGreaterThan(0);
    expect(byTestID(tree, "composer-action-bar").length).toBeGreaterThan(0);
    expect(byTestID(tree, "composer-bottom-bar").length).toBeGreaterThan(0);
    expect(byTestID(tree, "composer-open-preview")).toHaveLength(0);
    expect(allText(tree)).toContain("composer.newReceiptTitle");
  });

  it("has no customer-name field and shows the automatic-number hint", async () => {
    const tree = await renderScreen();
    expect(allText(tree)).not.toContain("receipts.client");
    expect(byTestID(tree, "receipt-number-auto-hint").length).toBeGreaterThan(0);
  });

  it("requires a line description before creating", async () => {
    const tree = await renderScreen();
    await act(async () => {
      byTestID(tree, "receipt-create")[0].props.onPress();
    });
    expect(receiptCalls()).toHaveLength(0);
    expect(allText(tree)).toContain("receipts.lineItemRequired");
  });

  it("posts the same body as before (no number, no client name)", async () => {
    mockApiFetch.mockResolvedValue({
      receipt: { id: "r1", receiptNumber: "NY-1", totalAmount: 100, currency: "HUF", qrUrl: "https://x" },
    });
    const tree = await renderScreen();
    const description = tree.root.findAll((n) => n.props?.testID === "receipt-item-0-description")[0];
    await act(async () => {
      description.props.onChangeText("Kávé");
    });
    await act(async () => {
      byTestID(tree, "receipt-create")[0].props.onPress();
      await Promise.resolve();
    });
    expect(receiptCalls()).toHaveLength(1);
    const [url, init] = receiptCalls()[0];
    expect(url).toBe("/api/receipts");
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty("clientName");
    expect(body).not.toHaveProperty("receiptNumber");
    expect(body).toMatchObject({ currency: "HUF", paymentMethod: "cash", language: "hu" });
    expect(body.lineItems).toEqual([expect.objectContaining({ description: "Kávé", quantity: 1, vatRate: 27 })]);
  });
});
