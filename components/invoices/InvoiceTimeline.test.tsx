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

  it("does not use the destructive/error color for a current step that isn't overdue", () => {
    // A sent invoice not yet past its due date is a normal, healthy state —
    // it must not render with the same red/error styling as an overdue one
    // (matches STATUS_VISUALS: `sent` is primary, only `overdue` is
    // destructive; see lib/invoices/status-visuals.ts).
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }),
    });
    const dueDot = tree.root.findByProps({ testID: "invoice-timeline-dot-due" });
    expect(dueDot.props.className).not.toContain("border-destructive");
    expect(dueDot.props.className).toContain("border-primary");
  });

  it("does not show the overdue tag next to the due date when not overdue", () => {
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }),
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.timeline.overdueTag");
  });

  it("lays the steps out in a single non-wrapping row so the connector lines stay continuous at narrow widths", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    const stepsRow = tree.root.findByProps({ testID: "invoice-timeline-steps" });
    expect(stepsRow.props.className).not.toContain("flex-wrap");
    expect(stepsRow.props.className).not.toContain("min-w-");
  });

  it("fills the connector line into the currently active step, not just fully-done steps", () => {
    // A sent, not-yet-due invoice: issued+sent are done, due is the active
    // (current) step — the line leading into "due" should read as reached,
    // not as a grey gap right before the highlighted step.
    const tree = renderTimeline({
      invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }),
    });
    const connector = tree.root.findByProps({ testID: "invoice-timeline-connector-due" });
    expect(connector.props.className).toContain("bg-primary");
    expect(connector.props.className).not.toContain("bg-border");
  });
});
