// components/invoices/InvoiceTimeline.tsx
// Status timeline (Kiállítva → Kiküldve → Esedékes → Fizetve) + NAV state,
// placed above the document preview on the invoice detail screen (D6).
//
// Each step is a centred column: [line-in][dot][line-out] on top, label, date
// and a short hint underneath. Drawing the connector as two halves owned by
// each step keeps the line exactly on the dot's centre at every width, and
// only one step is ever "current" — the thing the user is waiting on next.
import { Check, X } from "lucide-react-native";
import { useState } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatShortDate } from "@/lib/dates/format";
import { isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import type { Invoice } from "@/lib/invoices/types";

export type NavTimelineState = {
  status: string;
  label: string;
  transactionId?: string | null;
};

export type TimelineStepState = "done" | "current" | "alert" | "upcoming" | "skipped" | "cancelled";

export type TimelineStep = {
  key: "issued" | "sent" | "due" | "paid" | "cancelled";
  label: string;
  date?: string;
  /** i18n key + options for the short line under the date. */
  hint?: { key: string; options?: Record<string, unknown> };
  state: TimelineStepState;
};

/** Whole calendar days from `now` until the due date (negative once past). */
function daysUntilDue(dueDate: string, now: Date): number | null {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function timelineSteps(invoice: Invoice, now: Date): TimelineStep[] {
  const isDraft = invoice.status === "draft";
  const isPaid = invoice.status === "paid";
  const isPartiallyPaid = invoice.status === "partially_paid";
  const isCancelled = invoice.status === "cancelled";
  const overdue = isOverdue(invoice, now);
  // A finalized invoice that was never e-mailed is `unpaid`; everything past
  // that point (sent, overdue, (partially) paid) means the buyer has it.
  // There is no stored send timestamp, so the step carries no date rather
  // than a made-up one.
  const wasSent = !isDraft && invoice.status !== "unpaid" && invoice.status !== "proforma";
  const awaitingSend = !isDraft && !wasSent && !isCancelled;

  const issued: TimelineStep = isDraft
    ? { key: "issued", label: "invoices.timeline.issued", hint: { key: "invoices.timeline.draftHint" }, state: "current" }
    : { key: "issued", label: "invoices.timeline.issued", date: formatShortDate(invoice.issueDate, now), state: "done" };

  if (isCancelled) {
    return [
      issued,
      { key: "sent", label: "invoices.timeline.sent", state: "skipped" },
      { key: "due", label: "invoices.timeline.due", state: "skipped" },
      { key: "cancelled", label: "invoices.timeline.cancelled", state: "cancelled" },
    ];
  }

  const sent: TimelineStep = {
    key: "sent",
    label: "invoices.timeline.sent",
    hint: awaitingSend ? { key: "invoices.timeline.notSentHint" } : undefined,
    state: wasSent ? "done" : awaitingSend && !overdue ? "current" : "upcoming",
  };

  let dueHint: TimelineStep["hint"];
  if (!isPaid && !isDraft) {
    const days = daysUntilDue(invoice.dueDate, now);
    if (overdue) dueHint = { key: "invoices.timeline.overdueDays", options: { count: overdueDays(invoice, now) } };
    else if (days === 0) dueHint = { key: "invoices.timeline.dueToday" };
    else if (days !== null && days > 0) dueHint = { key: "invoices.timeline.dueInDays", options: { count: days } };
  }
  const due: TimelineStep = {
    key: "due",
    label: overdue ? "invoices.timeline.overdue" : "invoices.timeline.due",
    date: formatShortDate(invoice.dueDate, now),
    hint: dueHint,
    state: isPaid ? "done" : overdue ? "alert" : wasSent && !isPartiallyPaid ? "current" : "upcoming",
  };

  const paid: TimelineStep = {
    key: "paid",
    label: "invoices.timeline.paid",
    date: isPaid && invoice.paidAt ? formatShortDate(invoice.paidAt, now) : undefined,
    hint: isPartiallyPaid ? { key: "invoices.timeline.partiallyPaidHint" } : undefined,
    state: isPaid ? "done" : isPartiallyPaid && !overdue ? "current" : "upcoming",
  };

  return [issued, sent, due, paid];
}

/** Whether the line *into* this step is drawn as reached (a cancellation is an end, not progress). */
function reached(step: TimelineStep): boolean {
  return step.state === "done" || step.state === "current" || step.state === "alert";
}

function dotClass(step: TimelineStep): string {
  switch (step.state) {
    case "done":
      return step.key === "paid" ? "border-[#15803d] bg-[#15803d]" : "border-primary bg-primary";
    case "current":
      return "border-primary bg-background";
    case "alert":
      return "border-destructive bg-background";
    case "cancelled":
      return "border-destructive bg-destructive";
    case "skipped":
      return "border-dashed border-border bg-muted/40";
    default:
      return "border-border bg-background";
  }
}

function labelClass(step: TimelineStep): string {
  switch (step.state) {
    case "current":
      return "text-primary";
    case "alert":
    case "cancelled":
      return "text-destructive";
    case "skipped":
    case "upcoming":
      return "text-muted-foreground";
    default:
      return step.key === "paid" ? "text-[#15803d]" : "text-foreground";
  }
}

function hintClass(step: TimelineStep): string {
  if (step.state === "alert") return "font-medium text-destructive";
  if (step.state === "current") return "text-primary";
  return "text-muted-foreground";
}

function navTone(status: string): { chip: string; text: string } {
  const s = status.toLowerCase();
  if (s === "done") return { chip: "bg-[#15803d]/10", text: "text-[#15803d]" };
  if (s === "aborted") return { chip: "bg-destructive/10", text: "text-destructive" };
  return { chip: "bg-primary/10", text: "text-primary" };
}

function StepDot({ step }: { step: TimelineStep }) {
  return (
    <Box
      testID={`invoice-timeline-dot-${step.key}`}
      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${dotClass(step)}`}
    >
      {step.state === "done" ? <Check size={13} strokeWidth={3} color="#ffffff" /> : null}
      {step.state === "cancelled" ? <X size={13} strokeWidth={3} color="#ffffff" /> : null}
      {step.state === "current" ? <Box className="h-2 w-2 rounded-full bg-primary" /> : null}
      {step.state === "alert" ? <Box className="h-2 w-2 rounded-full bg-destructive" /> : null}
    </Box>
  );
}

/**
 * Below this container width the four columns no longer fit side by side
 * (labels and dates start colliding), so the steps stack vertically.
 */
export const TIMELINE_VERTICAL_BELOW = 520;

function StepText({ step }: { step: TimelineStep }) {
  const { t } = useTranslation();
  const textAlign = "text-center";
  return (
    <>
      <Text size="sm" className={`${textAlign} font-semibold ${labelClass(step)}`}>
        {t(step.label)}
      </Text>
      {step.date ? (
        <Text size="xs" className={`${textAlign} text-muted-foreground`}>
          {step.date}
        </Text>
      ) : null}
      {step.hint ? (
        <Text size="xs" className={`${textAlign} ${hintClass(step)}`} testID={`invoice-timeline-hint-${step.key}`}>
          {t(step.hint.key, step.hint.options)}
        </Text>
      ) : null}
    </>
  );
}

function HorizontalSteps({ steps }: { steps: TimelineStep[] }) {
  return (
    <HStack className="items-start px-2 pb-4 pt-5" testID="invoice-timeline-steps">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        const lineIn = index === 0 ? "bg-transparent" : reached(step) ? "bg-primary" : "bg-border";
        const lineOut = !next ? "bg-transparent" : reached(next) ? "bg-primary" : "bg-border";
        return (
          <VStack key={step.key} className="flex-1 items-center" testID={`invoice-timeline-step-${step.key}`}>
            <HStack className="w-full items-center">
              <Box testID={`invoice-timeline-line-in-${step.key}`} className={`h-0.5 flex-1 ${lineIn}`} />
              <StepDot step={step} />
              <Box testID={`invoice-timeline-line-out-${step.key}`} className={`h-0.5 flex-1 ${lineOut}`} />
            </HStack>
            <VStack className="mt-2 items-center px-1">
              <StepText step={step} />
            </VStack>
          </VStack>
        );
      })}
    </HStack>
  );
}

// Phone layout: a dot column with the connector running down between dots,
// text to the right. Each row owns the line segment below its dot.
function VerticalSteps({ steps }: { steps: TimelineStep[] }) {
  const { t } = useTranslation();
  return (
    <VStack className="px-4 pb-2 pt-4" testID="invoice-timeline-steps-vertical">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        return (
          <HStack key={step.key} space="md" className="items-stretch" testID={`invoice-timeline-step-${step.key}`}>
            <VStack className="w-6 items-center">
              <StepDot step={step} />
              {next ? (
                <Box
                  testID={`invoice-timeline-vline-${step.key}`}
                  className={`my-1 min-h-2 w-0.5 flex-1 ${reached(next) ? "bg-primary" : "bg-border"}`}
                />
              ) : null}
            </VStack>
            <VStack className={`flex-1 ${next ? "pb-4" : "pb-2"}`}>
              <HStack space="sm" className="min-h-6 items-center justify-between">
                <Text size="sm" className={`font-semibold ${labelClass(step)}`}>
                  {t(step.label)}
                </Text>
                {step.date ? (
                  <Text size="xs" className="text-muted-foreground">
                    {step.date}
                  </Text>
                ) : null}
              </HStack>
              {step.hint ? (
                <Text size="xs" className={hintClass(step)} testID={`invoice-timeline-hint-${step.key}`}>
                  {t(step.hint.key, step.hint.options)}
                </Text>
              ) : null}
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
}

export function InvoiceTimeline({
  invoice,
  nav,
  now = new Date(),
  layout = "auto",
}: {
  invoice: Invoice;
  nav?: NavTimelineState | null;
  now?: Date;
  /** "auto" picks by the card's measured width (see TIMELINE_VERTICAL_BELOW). */
  layout?: "auto" | "horizontal" | "vertical";
}) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  // Until the card is measured, guess from the window: phones start vertical,
  // so there's no squeezed first frame.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? window.width;
  const vertical = layout === "vertical" || (layout === "auto" && width < TIMELINE_VERTICAL_BELOW);
  const steps = timelineSteps(invoice, now);
  const showNav = invoice.status !== "draft";

  return (
    <VStack
      className="rounded-xl border border-subtle bg-background"
      testID="invoice-timeline"
      onLayout={(e: LayoutChangeEvent) => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      {vertical ? <VerticalSteps steps={steps} /> : <HorizontalSteps steps={steps} />}

      {showNav ? (
        <HStack
          space="sm"
          className="flex-wrap items-center justify-between border-t border-subtle px-4 py-3"
          testID="invoice-timeline-nav"
        >
          <Text size="xs" className="font-medium text-muted-foreground">
            {t("invoices.timeline.navLabel")}
          </Text>
          {nav ? (
            <HStack space="xs" className={`items-center rounded-full px-2.5 py-1 ${navTone(nav.status).chip}`}>
              <Text size="xs" className={`font-semibold ${navTone(nav.status).text}`}>
                {nav.label}
              </Text>
              {nav.transactionId ? (
                <Text size="xs" className="font-mono text-muted-foreground">
                  {nav.transactionId}
                </Text>
              ) : null}
            </HStack>
          ) : (
            <Text size="xs" className="text-muted-foreground" testID="invoice-timeline-nav-none">
              {t("invoices.timeline.navNotSubmitted")}
            </Text>
          )}
        </HStack>
      ) : null}
    </VStack>
  );
}
