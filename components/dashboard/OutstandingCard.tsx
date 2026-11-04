// components/dashboard/OutstandingCard.tsx
// Kintlévőség hero card (tokens.md §6.16): the outstanding amount, how many
// invoices that is, and a split bar of "not due yet" (primary) against
// "overdue" (err). Bar segments and legend rows are buttons that open the
// matching filtered invoice list.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { splitMoney } from "@/lib/dashboard/money-parts";
import { splitOutstanding } from "@/lib/dashboard/todo-summary";
import { formatCurrency } from "@/lib/invoices/calculations";
import { type } from "@/lib/ui/type";

export type OutstandingCardProps = {
  outstanding: number;
  overdueTotal: number;
  /** Number of unpaid (outstanding) invoices. */
  outstandingCount: number;
  overdueCount: number;
  /** "2026. 11. 03." */
  asOf: string;
  loading?: boolean;
  /** Extra classes for the card (the wide grid passes "flex-1" so it fills the row's height). */
  className?: string;
  /** Opens the list of outstanding invoices (legend-less fallback and the hero number). */
  onOpenAll: () => void;
  onOpenNotDue: () => void;
  onOpenOverdue: () => void;
};

export function OutstandingCard({
  outstanding,
  overdueTotal,
  outstandingCount,
  overdueCount,
  asOf,
  loading = false,
  className = "",
  onOpenAll,
  onOpenNotDue,
  onOpenOverdue,
}: OutstandingCardProps) {
  const { t } = useTranslation();
  const split = splitOutstanding({ outstanding, overdueTotal, outstandingCount, overdueCount });
  const money = splitMoney(formatCurrency(outstanding, "HUF"));
  const bothSegments = split.notDueShare > 0 && split.overdueShare > 0;

  return (
    <Card testID="dashboard-outstanding" className={`gap-0 px-[22px] py-5 ${className}`}>
      <HStack className="items-baseline justify-between gap-3">
        <Heading className={type.sectionTitle}>{t("dashboard.kpi.outstanding")}</Heading>
        <Text className="text-xs text-muted-ink">{t("home.outstanding.asOf", { date: asOf })}</Text>
      </HStack>

      {loading ? (
        <VStack testID="dashboard-outstanding-skeleton" space="sm" className="mt-4">
          <Box className="h-8 w-48 animate-pulse rounded bg-neutral-wash" />
          <Box className="h-4 w-28 animate-pulse rounded bg-neutral-wash" />
          <Box className="mt-5 h-4 w-full animate-pulse rounded-full bg-neutral-wash" />
        </VStack>
      ) : (
        <>
          <Pressable
            testID="dashboard-outstanding-open-all"
            accessibilityRole="button"
            accessibilityLabel={t("home.outstanding.openAll")}
            onPress={onOpenAll}
            className="mt-3 self-start data-[hover=true]:opacity-80"
          >
            <HStack className="items-baseline gap-1.5">
              <Text className={`${type.heroNumber} text-ink`} testID="dashboard-outstanding-amount">
                {money.value}
              </Text>
              {money.unit ? <Text className="text-base font-semibold text-muted-ink">{money.unit}</Text> : null}
            </HStack>
          </Pressable>
          <Text className={`${type.meta} mt-0.5`} testID="dashboard-outstanding-count">
            {outstandingCount > 0
              ? t("home.outstanding.unpaidCount", { count: outstandingCount })
              : t("home.outstanding.none")}
          </Text>

          {split.hasBar ? (
            <HStack testID="dashboard-outstanding-bar" className="mt-6 h-4 gap-[3px]">
              {split.notDueShare > 0 ? (
                <Pressable
                  testID="dashboard-outstanding-segment-not-due"
                  accessibilityRole="button"
                  accessibilityLabel={t("home.outstanding.openNotDue")}
                  onPress={onOpenNotDue}
                  style={{ flexGrow: split.notDueShare, flexBasis: 0, minWidth: 10 }}
                  className={`h-4 bg-primary data-[hover=true]:opacity-90 ${
                    bothSegments ? "rounded-l-[8px] rounded-r-[3px]" : "rounded-[8px]"
                  }`}
                />
              ) : null}
              {split.overdueShare > 0 ? (
                <Pressable
                  testID="dashboard-outstanding-segment-overdue"
                  accessibilityRole="button"
                  accessibilityLabel={t("home.outstanding.openOverdue")}
                  onPress={onOpenOverdue}
                  style={{ flexGrow: split.overdueShare, flexBasis: 0, minWidth: 10 }}
                  className={`h-4 bg-err data-[hover=true]:opacity-90 ${
                    bothSegments ? "rounded-l-[3px] rounded-r-[8px]" : "rounded-[8px]"
                  }`}
                />
              ) : null}
            </HStack>
          ) : (
            <Box testID="dashboard-outstanding-bar-empty" className="mt-6 h-4 rounded-[8px] bg-neutral-wash" />
          )}

          <HStack className="mt-3 flex-wrap gap-x-6 gap-y-1">
            <LegendRow
              testID="dashboard-outstanding-legend-not-due"
              dotClass="bg-primary"
              label={t("home.outstanding.notDue")}
              amount={formatCurrency(split.notDue, "HUF")}
              amountClass="text-ink"
              count={t("home.outstanding.invoiceCount", { count: split.notDueCount })}
              onPress={onOpenNotDue}
              accessibilityLabel={t("home.outstanding.openNotDue")}
            />
            <LegendRow
              testID="dashboard-outstanding-legend-overdue"
              dotClass="bg-err"
              label={t("home.outstanding.overdue")}
              amount={formatCurrency(split.overdue, "HUF")}
              amountClass="text-err"
              count={t("home.outstanding.invoiceCount", { count: split.overdueCount })}
              onPress={onOpenOverdue}
              accessibilityLabel={t("home.outstanding.openOverdue")}
            />
          </HStack>
        </>
      )}
    </Card>
  );
}

function LegendRow({
  testID,
  dotClass,
  label,
  amount,
  amountClass,
  count,
  onPress,
  accessibilityLabel,
}: {
  testID: string;
  dotClass: string;
  label: string;
  amount: string;
  amountClass: string;
  count: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="min-h-[28px] justify-center rounded-control data-[hover=true]:opacity-80"
    >
      <HStack className="flex-wrap items-center gap-x-2 gap-y-0.5">
        <Box className={`h-[9px] w-[9px] rounded-full ${dotClass}`} />
        <Text className="text-[13px] text-ink">
          {label} <Text className={`text-[13px] font-semibold ${amountClass} ${type.money}`}>{amount}</Text>
        </Text>
        <Text className="text-xs text-muted-ink">{count}</Text>
      </HStack>
    </Pressable>
  );
}
