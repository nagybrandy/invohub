// components/invoices/InvoiceTimeline.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceTimeline, timelineSteps } from "@/components/invoices/InvoiceTimeline";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
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

const states = (invoice: Parameters<typeof timelineSteps>[0]) =>
  Object.fromEntries(timelineSteps(invoice, now).map((s) => [s.key, s.state]));

describe("timelineSteps", () => {
  it("has exactly one current step for a draft: issuing it", () => {
    expect(states(makeInvoice({ status: "draft" }))).toEqual({
      issued: "current",
      sent: "upcoming",
      due: "upcoming",
      paid: "upcoming",
    });
  });

  it("points a finalized but never e-mailed invoice at the send step", () => {
    const steps = timelineSteps(makeInvoice({ status: "unpaid", dueDate: "2026-12-31" }), now);
    const sent = steps.find((s) => s.key === "sent")!;
    expect(sent.state).toBe("current");
    expect(sent.hint?.key).toBe("invoices.timeline.notSentHint");
    expect(steps.find((s) => s.key === "due")!.state).toBe("upcoming");
  });

  it("never invents a send date (there is no stored send timestamp)", () => {
    const sent = timelineSteps(makeInvoice({ status: "sent" }), now).find((s) => s.key === "sent")!;
    expect(sent.state).toBe("done");
    expect(sent.date).toBeUndefined();
  });

  it("waits on the due date for a sent invoice and says how many days are left", () => {
    const due = timelineSteps(makeInvoice({ status: "sent", dueDate: "2026-09-24" }), now).find(
      (s) => s.key === "due"
    )!;
    expect(due.state).toBe("current");
    expect(due.hint).toEqual({ key: "invoices.timeline.dueInDays", options: { count: 10 } });
  });

  it("says 'due today' on the due date", () => {
    const due = timelineSteps(makeInvoice({ status: "sent", dueDate: "2026-09-14" }), now).find(
      (s) => s.key === "due"
    )!;
    expect(due.hint?.key).toBe("invoices.timeline.dueToday");
  });

  it("turns the due step into an overdue alert with the number of days late", () => {
    const due = timelineSteps(makeInvoice({ status: "sent", dueDate: "2026-09-01" }), now).find(
      (s) => s.key === "due"
    )!;
    expect(due.state).toBe("alert");
    expect(due.label).toBe("invoices.timeline.overdue");
    expect(due.hint).toEqual({ key: "invoices.timeline.overdueDays", options: { count: 13 } });
  });

  it("marks everything done for a paid invoice, dated with the payment date", () => {
    const steps = timelineSteps(makeInvoice({ status: "paid", paidAt: "2026-09-10" }), now);
    expect(steps.every((s) => s.state === "done")).toBe(true);
    expect(steps.find((s) => s.key === "paid")!.date).toBeDefined();
    expect(steps.find((s) => s.key === "due")!.hint).toBeUndefined();
  });

  it("makes the payment step current for a partially paid invoice", () => {
    const paid = timelineSteps(
      makeInvoice({ status: "partially_paid", dueDate: "2026-12-31" }),
      now
    ).find((s) => s.key === "paid")!;
    expect(paid.state).toBe("current");
    expect(paid.hint?.key).toBe("invoices.timeline.partiallyPaidHint");
  });

  it("ends a cancelled invoice's timeline in a cancelled step instead of 'paid'", () => {
    const steps = timelineSteps(makeInvoice({ status: "cancelled" }), now);
    expect(steps.map((s) => s.key)).toEqual(["issued", "sent", "due", "cancelled"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "skipped", "skipped", "cancelled"]);
  });

  it("does not draw the line into a cancellation as progress", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "cancelled" }) });
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-in-cancelled" }).props.className).toContain(
      "bg-border"
    );
  });
});

describe("InvoiceTimeline", () => {
  it("renders the four status steps", () => {
    const json = JSON.stringify(
      renderTimeline({ invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }) }).toJSON()
    );
    for (const key of ["issued", "sent", "due", "paid"]) {
      expect(json).toContain(`invoices.timeline.${key}`);
    }
  });

  it("colors an overdue due step as destructive, and a healthy current one as primary", () => {
    const overdue = renderTimeline({ invoice: makeInvoice({ status: "sent", dueDate: "2026-08-01" }) });
    expect(overdue.root.findByProps({ testID: "invoice-timeline-dot-due" }).props.className).toContain(
      "border-destructive"
    );
    const healthy = renderTimeline({ invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }) });
    const dot = healthy.root.findByProps({ testID: "invoice-timeline-dot-due" }).props.className;
    expect(dot).toContain("border-primary");
    expect(dot).not.toContain("destructive");
  });

  it("draws the connector into the current step as reached, and past it as not yet", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent", dueDate: "2026-12-31" }) });
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-in-due" }).props.className).toContain("bg-primary");
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-out-sent" }).props.className).toContain(
      "bg-primary"
    );
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-in-paid" }).props.className).toContain("bg-border");
  });

  it("leaves the outer ends of the first and last steps without a line", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-in-issued" }).props.className).toContain(
      "bg-transparent"
    );
    expect(tree.root.findByProps({ testID: "invoice-timeline-line-out-paid" }).props.className).toContain(
      "bg-transparent"
    );
  });

  it("lays the steps out in a single non-wrapping row", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    expect(tree.root.findByProps({ testID: "invoice-timeline-steps" }).props.className).not.toContain("flex-wrap");
  });

  it("shows the NAV row as not submitted when no nav state is passed", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "sent" }) });
    expect(() => tree.root.findByProps({ testID: "invoice-timeline-nav-none" })).not.toThrow();
  });

  it("shows the NAV status and transaction id when nav state is passed", () => {
    const json = JSON.stringify(
      renderTimeline({
        invoice: makeInvoice({ status: "sent" }),
        nav: { status: "done", label: "Kész", transactionId: "4XYZ123" },
      }).toJSON()
    );
    expect(json).toContain("Kész");
    expect(json).toContain("4XYZ123");
  });

  it("hides the NAV row on a draft, which can't be submitted yet", () => {
    const tree = renderTimeline({ invoice: makeInvoice({ status: "draft" }) });
    expect(() => tree.root.findByProps({ testID: "invoice-timeline-nav" })).toThrow();
  });
});
