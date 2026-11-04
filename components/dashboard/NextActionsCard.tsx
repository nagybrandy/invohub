// components/dashboard/NextActionsCard.tsx
// "Következő lépések" (SPEC §7.1, tokens.md §6.16): up to three cards, each
// backed by real data and mounted only when its count says it exists, so a
// card's own invoice query (useInvoices, three rows) only runs when needed:
//   - NAV-hiba      critical outline; the failed invoices; Megnyitás + Mind megnézem
//   - Lejárt fizetés  the overdue total, up to three overdue invoices with "N napja"
//   - Piszkozat      the drafts, up to three
// or one "Minden elintézve" card. There is deliberately NO NAV resubmit and
// NO reminder button here: both would be new send entry points (SPEC §11).
// Count badge next to the title = number of cards.
import * as React from "react";
import { AlertTriangle, Check, Clock, FileText } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useInvoices } from "@/hooks/useInvoices";
import { computeTodoSummary } from "@/lib/dashboard/todo-summary";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { overdueDays } from "@/lib/invoices/status-visuals";
import type { Invoice } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";
import { type } from "@/lib/ui/type";

export type NextActionTarget = "navFailed" | "overdue" | "draft";

const CARD_MIN_WIDTH = 270;
const CARD_GAP = 14;
const MAX_ROWS = 3;

/** How many cards fit side by side (auto-fit, minmax(270px, 1fr)); never more than 3. */
export function cardColumns(containerWidth: number): number {
  if (containerWidth <= 0) return 1;
  return Math.max(1, Math.min(3, Math.floor((containerWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP))));
}

export type NextActionsCardProps = {
  navFailedCount?: number;
  overdueCount: number;
  overdueTotal: number;
  draftCount: number;
  loading?: boolean;
  /** Opens the filtered invoice list. */
  onSelect: (target: NextActionTarget) => void;
  /** Opens one invoice. */
  onOpenInvoice: (id: string) => void;
};

export function NextActionsCard({
  navFailedCount = 0,
  overdueCount,
  overdueTotal,
  draftCount,
  loading = false,
  onSelect,
  onOpenInvoice,
}: NextActionsCardProps) {
  const { t } = useTranslation();
  const { width, onLayout } = useMeasuredWidth();
  const summary = computeTodoSummary({ navFailedCount, overdueCount, draftCount });
  const columns = cardColumns(width);
  const cardWidth = width > 0 ? Math.floor((width - CARD_GAP * (columns - 1)) / columns) : undefined;

  const cards: React.ReactNode[] = [];
  if (!loading) {
    if (navFailedCount > 0) {
      cards.push(
        <NavFailedCard key="nav" count={navFailedCount} onSelect={onSelect} onOpenInvoice={onOpenInvoice} />,
      );
    }
    if (overdueCount > 0) {
      cards.push(
        <OverdueCard
          key="overdue"
          count={overdueCount}
          total={overdueTotal}
          onSelect={onSelect}
          onOpenInvoice={onOpenInvoice}
        />,
      );
    }
    if (draftCount > 0) {
      cards.push(<DraftsCard key="drafts" count={draftCount} onSelect={onSelect} onOpenInvoice={onOpenInvoice} />);
    }
  }

  return (
    <VStack space="md" testID="dashboard-next-steps">
      <HStack className="items-center gap-2">
        <Heading className={type.sectionTitle}>{t("dashboard.nextActions.title")}</Heading>
        {!loading && summary.total > 0 ? (
          <Box
            testID="next-actions-count"
            accessibilityLabel={t("home.nextSteps.badgeLabel", { count: summary.total })}
            className="h-5 min-w-[20px] items-center justify-center rounded-full bg-err px-1.5"
          >
            <Text className="text-xs font-bold text-white">{summary.total}</Text>
          </Box>
        ) : null}
      </HStack>

      <Box onLayout={onLayout} className="w-full">
        {loading ? (
          <Card testID="next-actions-loading" className="gap-3 px-5 py-[18px]">
            <Box className="h-4 w-32 animate-pulse rounded bg-neutral-wash" />
            <Box className="h-5 w-3/4 animate-pulse rounded bg-neutral-wash" />
            <Box className="h-4 w-full animate-pulse rounded bg-neutral-wash" />
          </Card>
        ) : summary.allDone ? (
          <AllClearCard />
        ) : (
          <HStack className="flex-wrap items-stretch" style={{ gap: CARD_GAP }} testID="next-actions-rows">
            {cards.map((card, index) => (
              <Box
                key={index}
                className={cardWidth ? "" : "w-full"}
                style={cardWidth ? { width: cardWidth } : undefined}
              >
                {card}
              </Box>
            ))}
          </HStack>
        )}
      </Box>
    </VStack>
  );
}

// ---- Shared pieces -------------------------------------------------------

type CardFrameProps = {
  testID: string;
  critical?: boolean;
  icon: LucideIcon;
  /** Tailwind classes for the 30px icon circle (ignored for the critical bare triangle). */
  circleClass: string;
  iconColor: string;
  label: string;
  labelClass?: string;
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
};

function CardFrame({
  testID,
  critical = false,
  icon: Icon,
  circleClass,
  iconColor,
  label,
  labelClass = "text-muted-ink",
  title,
  children,
  actions,
}: CardFrameProps) {
  return (
    <Card
      testID={testID}
      className={`h-full gap-3 px-5 py-[18px] ${critical ? "border-[1.5px] border-err-line" : ""}`}
    >
      <HStack className="items-center gap-2.5">
        {critical ? (
          <Icon size={22} color={iconColor} />
        ) : (
          <Box className={`h-[30px] w-[30px] items-center justify-center rounded-full ${circleClass}`}>
            <Icon size={16} color={iconColor} />
          </Box>
        )}
        <Text className={`text-[13px] ${critical ? "font-semibold" : "font-medium"} ${labelClass}`}>{label}</Text>
      </HStack>
      <Text className={type.itemTitle}>{title}</Text>
      <Box className="flex-1 gap-0.5">{children}</Box>
      <HStack className="items-center gap-2">{actions}</HStack>
    </Card>
  );
}

function RowSkeleton() {
  return (
    <VStack space="sm" testID="next-step-rows-loading">
      <Box className="h-4 w-full animate-pulse rounded bg-neutral-wash" />
      <Box className="h-4 w-2/3 animate-pulse rounded bg-neutral-wash" />
    </VStack>
  );
}

function amountOf(invoice: Invoice): string {
  return formatCurrency(calculateInvoiceTotals(invoice.lineItems).totalAmount, invoice.currency);
}

function InvoiceRow({
  invoice,
  onPress,
  left,
  right,
  testID,
}: {
  invoice: Invoice;
  onPress: (id: string) => void;
  left: React.ReactNode;
  right: React.ReactNode;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => onPress(invoice.id)}
      className="-mx-2 min-h-10 justify-center rounded-control px-2 py-1.5 data-[hover=true]:bg-wash2"
    >
      <HStack className="items-start justify-between gap-3">
        <VStack className="min-w-0 flex-1">{left}</VStack>
        {right}
      </HStack>
    </Pressable>
  );
}

// ---- NAV error -----------------------------------------------------------

function NavFailedCard({
  count,
  onSelect,
  onOpenInvoice,
}: {
  count: number;
  onSelect: (target: NextActionTarget) => void;
  onOpenInvoice: (id: string) => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { invoices, loading } = useInvoices({ navFailed: true, pageSize: MAX_ROWS });
  const first = invoices[0];

  return (
    <CardFrame
      testID="next-step-nav"
      critical
      icon={AlertTriangle}
      circleClass=""
      iconColor={icons.destructive}
      label={t("home.nextSteps.nav.label")}
      labelClass="text-err"
      title={t("home.nextSteps.nav.title", { count })}
      actions={
        <>
          <Button
            testID="next-step-nav-open"
            variant="primary"
            className="flex-1"
            onPress={() => (first ? onOpenInvoice(first.id) : onSelect("navFailed"))}
          >
            <ButtonText>{t("home.nextSteps.nav.open")}</ButtonText>
          </Button>
          <Button testID="next-step-nav-all" variant="tertiary" onPress={() => onSelect("navFailed")}>
            <ButtonText>{t("home.nextSteps.nav.openAll")}</ButtonText>
          </Button>
        </>
      }
    >
      {loading && invoices.length === 0 ? (
        <RowSkeleton />
      ) : (
        invoices.slice(0, MAX_ROWS).map((invoice) => (
          <InvoiceRow
            key={invoice.id}
            testID="next-step-nav-row"
            invoice={invoice}
            onPress={onOpenInvoice}
            left={
              <Text className="text-[13px] text-ink">
                {[invoice.invoiceNumber, invoice.clientName].filter(Boolean).join(" · ")}
              </Text>
            }
            right={null}
          />
        ))
      )}
    </CardFrame>
  );
}

// ---- Overdue -------------------------------------------------------------

function OverdueCard({
  count,
  total,
  onSelect,
  onOpenInvoice,
}: {
  count: number;
  total: number;
  onSelect: (target: NextActionTarget) => void;
  onOpenInvoice: (id: string) => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { invoices, loading } = useInvoices({ status: "overdue", pageSize: MAX_ROWS });
  const now = new Date();

  return (
    <CardFrame
      testID="next-step-overdue"
      icon={Clock}
      circleClass="bg-warn-wash"
      iconColor={icons.warn}
      label={t("home.nextSteps.overdue.label", { count })}
      title={t("home.nextSteps.overdue.title", { amount: formatCurrency(total, "HUF") })}
      actions={
        <Button
          testID="next-step-overdue-open"
          variant="secondary"
          className="flex-1"
          onPress={() => onSelect("overdue")}
        >
          <ButtonText>{t("home.nextSteps.overdue.open")}</ButtonText>
        </Button>
      }
    >
      {loading && invoices.length === 0 ? (
        <RowSkeleton />
      ) : (
        invoices.slice(0, MAX_ROWS).map((invoice) => {
          const days = overdueDays(invoice, now);
          return (
            <InvoiceRow
              key={invoice.id}
              testID="next-step-overdue-row"
              invoice={invoice}
              onPress={onOpenInvoice}
              left={
                <>
                  <Text className="text-[13px] text-ink">{invoice.clientName}</Text>
                  <Text className="text-xs text-warn">
                    {days > 0 ? t("home.nextSteps.overdue.daysAgo", { count: days }) : t("home.nextSteps.overdue.dueToday")}
                  </Text>
                </>
              }
              right={<Text className={`text-[13px] font-bold text-ink ${type.money}`}>{amountOf(invoice)}</Text>}
            />
          );
        })
      )}
    </CardFrame>
  );
}

// ---- Drafts --------------------------------------------------------------

function DraftsCard({
  count,
  onSelect,
  onOpenInvoice,
}: {
  count: number;
  onSelect: (target: NextActionTarget) => void;
  onOpenInvoice: (id: string) => void;
}) {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { invoices, loading } = useInvoices({ status: "draft", pageSize: MAX_ROWS });

  return (
    <CardFrame
      testID="next-step-drafts"
      icon={FileText}
      circleClass="bg-neutral-wash"
      iconColor={icons.muted}
      label={t("home.nextSteps.drafts.label", { count })}
      title={t("home.nextSteps.drafts.title", { count })}
      actions={
        <Button
          testID="next-step-drafts-open"
          variant="secondary"
          className="flex-1"
          onPress={() => onSelect("draft")}
        >
          <ButtonText>{t("home.nextSteps.drafts.open")}</ButtonText>
        </Button>
      }
    >
      {loading && invoices.length === 0 ? (
        <RowSkeleton />
      ) : (
        invoices.slice(0, MAX_ROWS).map((invoice) => (
          <InvoiceRow
            key={invoice.id}
            testID="next-step-drafts-row"
            invoice={invoice}
            onPress={onOpenInvoice}
            left={
              <Text className="text-[13px] text-ink">
                {invoice.clientName?.trim() ? invoice.clientName : t("home.nextSteps.drafts.untitled")}
              </Text>
            }
            right={<Text className={`text-[13px] font-bold text-ink ${type.money}`}>{amountOf(invoice)}</Text>}
          />
        ))
      )}
    </CardFrame>
  );
}

// ---- All clear -----------------------------------------------------------

function AllClearCard() {
  const { t } = useTranslation();
  const icons = useIconColors();
  return (
    <Card testID="next-actions-all-clear" className="flex-row items-center gap-3.5 px-5 py-[18px]">
      <Box className="h-10 w-10 items-center justify-center rounded-full bg-ok-wash">
        <Check size={20} color={icons.ok} />
      </Box>
      <VStack className="min-w-0 flex-1" space="xs">
        <Text className={`${type.itemTitle} text-ok`}>{t("home.nextSteps.allClear.title")}</Text>
        <Text className={type.meta}>{t("home.nextSteps.allClear.text")}</Text>
      </VStack>
    </Card>
  );
}
