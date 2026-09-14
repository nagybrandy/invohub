// components/invoices/InvoiceTimeline.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceTimeline } from "@/components/invoices/InvoiceTimeline";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

const now = new Date("2026-09-14T12:00:00.000Z");

function renderTimeline(props: React.ComponentProps<typeof InvoiceTimeline>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceTimeline now={now} {...props} />);
  });
  return tree!;
}

describe("InvoiceTimeline", () => {
  it("renders all four status steps", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.timeline.issued");
    expect(json).toContain("invoices.timeline.sent");
    expect(json).toContain("invoices.timeline.due");
    expect(json).toContain("invoices.timeline.paid");
  });

  it("marks the paid step done and dated when the invoice is paid", () => {
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "paid", paidAt: "2026-06-20" }),
    });
    const dot = tree.root.findByProps({ testID: "invoice-timeline-dot-paid" });
    expect(dot.props.className).toContain("bg-primary");
  });

  it("shows the NAV row as not submitted when no nav state is passed", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    expect(() => tree.root.findByProps({ testID: "invoice-timeline-nav-none" })).not.toThrow();
  });

  it("shows the NAV transaction id when nav state is passed", () => {
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "sent" }),
      nav: { status: "done", label: "Kész", transactionId: "4XYZ123" },
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("4XYZ123");
  });

  it("flags the due step as current (not upcoming) for an overdue still-sent invoice", () => {
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "sent", dueDate: "2026-08-01" }),
    });
    const dueDot = tree.root.findByProps({ testID: "invoice-timeline-dot-due" });
    expect(dueDot.props.className).toContain("border-destructive");
  });
});
