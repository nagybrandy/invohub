// components/invoices/InvoiceTimeline.tsx
// Status timeline (Kiállítva → Kiküldve → Esedékes → Fizetve) + NAV state,
// placed above the document preview on the invoice detail screen (D6).
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatDateOnly } from "@/lib/dates/format";
import { isOverdue } from "@/lib/invoices/status-visuals";
import type { Invoice } from "@/lib/invoices/types";

export type NavTimelineState = {
  status: string;
  label: string;
  transactionId?: string | null;
};

type TimelineStepState = "done" | "current" | "upcoming" | "skipped";

type TimelineStep = {
  key: string;
  label: string;
  date?: string;
  state: TimelineStepState;
};

function stepsFor(invoice: Invoice, now: Date): TimelineStep[] {
  const overdue = isOverdue(invoice, now);
  const wasSent = invoice.status !== "draft";
  const isPaid = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";

  return [
    {
      key: "issued",
      label: "invoices.timeline.issued",
      date: wasSent ? formatDateOnly(invoice.issueDate) : undefined,
      state: wasSent ? "done" : "current",
    },
    {
      key: "sent",
      label: "invoices.timeline.sent",
      date: wasSent ? formatDateOnly(invoice.issueDate) : undefined,
      state: isCancelled ? "skipped" : wasSent ? "done" : "upcoming",
    },
    {
      key: "due",
      label: "invoices.timeline.due",
      date: formatDateOnly(invoice.dueDate),
      state: isCancelled
        ? "skipped"
        : isPaid
          ? "done"
          : overdue
            ? "current"
            : wasSent
              ? "current"
              : "upcoming",
    },
    {
      key: "paid",
      label: "invoices.timeline.paid",
      date: isPaid && invoice.paidAt ? formatDateOnly(invoice.paidAt) : undefined,
      state: isCancelled ? "skipped" : isPaid ? "done" : "upcoming",
    },
  ];
}

const DOT_CLASS: Record<TimelineStepState, string> = {
  done: "bg-primary border-primary",
  current: "border-destructive bg-background",
  upcoming: "border-border bg-background",
  skipped: "border-border/50 bg-muted/60",
};

export function InvoiceTimeline({
  invoice,
  nav,
  now = new Date(),
}: {
  invoice: Invoice;
  nav?: NavTimelineState | null;
  now?: Date;
}) {
  const { t } = useTranslation();
  const steps = stepsFor(invoice, now);
  const overdue = isOverdue(invoice, now);

  return (
    <VStack space="sm" className="rounded-xl border border-subtle p-4" testID="invoice-timeline">
      <HStack className="flex-wrap items-start">
        {steps.map((step, index) => (
          <HStack key={step.key} className="min-w-[140px] flex-1 items-start">
            {index > 0 ? (
              <Box
                className={`mt-2 h-px flex-1 ${step.state === "done" ? "bg-primary" : "bg-border"}`}
              />
            ) : null}
            <VStack space="xs" className="items-start px-1">
              <Box
                testID={`invoice-timeline-dot-${step.key}`}
                className={`h-3 w-3 rounded-full border-2 ${DOT_CLASS[step.state]}`}
              />
              <Text
                size="xs"
                className={
                  step.state === "current"
                    ? "font-medium text-destructive"
                    : step.state === "skipped"
                      ? "text-muted-foreground/60"
                      : "font-medium text-foreground"
                }
              >
                {t(step.label)}
              </Text>
              {step.date ? (
                <Text size="xs" className="text-muted-foreground">
                  {step.date}
                  {step.key === "due" && overdue
                    ? ` (${t("invoices.timeline.overdueTag")})`
                    : ""}
                </Text>
              ) : null}
            </VStack>
          </HStack>
        ))}
      </HStack>

      <HStack space="sm" className="items-center border-t border-subtle pt-3">
        <Text size="xs" className="font-medium text-muted-foreground">
          {t("invoices.timeline.navLabel")}
        </Text>
        {nav ? (
          <HStack space="xs" className="items-center">
            <Box
              className={`h-2 w-2 rounded-full ${nav.status.toLowerCase() === "done" ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
            <Text size="xs" className="text-foreground">
              {nav.label}
              {nav.transactionId ? ` · ${nav.transactionId}` : ""}
            </Text>
          </HStack>
        ) : (
          <Text size="xs" className="text-muted-foreground" testID="invoice-timeline-nav-none">
            {t("invoices.timeline.navNotSubmitted")}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}
