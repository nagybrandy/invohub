// components/invoices/InvoiceMoneyHeader.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceMoneyHeader } from "@/components/invoices/InvoiceMoneyHeader";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

const now = new Date("2026-09-14T12:00:00.000Z");

function renderHeader(props: React.ComponentProps<typeof InvoiceMoneyHeader>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceMoneyHeader now={now} {...props} />);
  });
  return tree!;
}

describe("InvoiceMoneyHeader", () => {
  it("shows the gross amount in large type", () => {
    const invoice = makeInvoice({
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000, vatRate: 27 })],
      currency: "HUF",
    });
    const tree = renderHeader({ invoice });
    const gross = tree.root.findByProps({ testID: "invoice-money-header-gross" });
    expect(JSON.stringify(gross.props.children)).toContain("1,270");
  });

  it("derives 'Lejárt N napja' for a still-`sent` invoice whose due date passed (D3)", () => {
    const invoice = makeInvoice({ status: "sent", dueDate: "2026-08-30" });
    const tree = renderHeader({ invoice });
    const overdueLabel = tree.root.findByProps({ testID: "invoice-money-header-overdue" });
    expect(JSON.stringify(overdueLabel.props.children)).toContain("15");
  });

  it("does not show the overdue label for a paid invoice", () => {
    const invoice = makeInvoice({ status: "paid", dueDate: "2026-01-01" });
    const tree = renderHeader({ invoice });
    expect(() => tree.root.findByProps({ testID: "invoice-money-header-overdue" })).toThrow();
  });

  it("shows the outstanding balance net of any partial payment", () => {
    const invoice = makeInvoice({
      status: "partially_paid",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000, vatRate: 0 })],
      paidAmount: 400,
      currency: "HUF",
    });
    const tree = renderHeader({ invoice });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.detail.outstanding");
  });
});
