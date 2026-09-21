// components/invoices/NavExchangeRateAuditCard.tsx
// Purely presentational audit card: renders only when the invoice's latest
// real NAV submission is known to disagree with the invoice's current HUF
// exchange rate (NavExchangeRateReport.kind === "misreported"). The screen
// owns data loading and routes the two actions — this component emits no
// fetch, no navigation, no NAV call of its own.
// docs/plans/2026-09-21-retro-correct-non-huf-invoices-nav-modify.md
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency } from "@/lib/invoices/types";
import type { NavExchangeRateReport, NavHufMisreport } from "@/lib/nav/reported-rate";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
import { useIsDesktop } from "@/lib/useIsDesktop";

type Misreported = Extract<NavExchangeRateReport, { kind: "misreported" }>;

/** The status+api.ts payload: a misreported classification enriched with HUF amounts when a current rate exists. */
export type NavExchangeRateAuditReport =
  | Exclude<NavExchangeRateReport, { kind: "misreported" }>
  | (Misreported & Partial<NavHufMisreport>);

export type NavExchangeRateAuditCardProps = {
  report: NavExchangeRateAuditReport;
  /** The invoice's own (document) currency — interpolated into the copy. */
  currency: InvoiceCurrency;
  /** Runs the existing "Helyesbítő számla" flow (POST /api/invoices/[id]/modify + navigate). */
  onIssueCorrection: () => void;
  /** Routes to the composer's exchange-rate field (item 10's deep link). */
  onAddRate: () => void;
  busy?: boolean;
};

function formatRate(rate: number): string {
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 6 }).format(rate);
}

export function NavExchangeRateAuditCard({
  report,
  currency,
  onIssueCorrection,
  onAddRate,
  busy = false,
}: NavExchangeRateAuditCardProps) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  if (report.kind !== "misreported") return null;

  const hasAmounts = report.currentRate !== null && report.correctVatHuf !== undefined;
  const reportedRateText = formatRate(report.reportedRate);
  const currentRateText = report.currentRate !== null ? formatRate(report.currentRate) : null;

  return (
    <Card
      testID="nav-exchange-rate-audit-card"
      className="border border-destructive/40 bg-destructive/10 p-4"
    >
      <VStack space="sm">
        <Text className="font-semibold text-destructive">
          {t("invoices.navExchangeRateAudit.title")}
        </Text>

        {hasAmounts ? (
          <Text size="sm" className="text-muted-foreground">
            {t("invoices.navExchangeRateAudit.body", {
              currency,
              reportedRate: reportedRateText,
              currentRate: currentRateText,
              reportedVat: formatCurrency(report.reportedVatHuf!, "HUF"),
              correctVat: formatCurrency(report.correctVatHuf!, "HUF"),
            })}
          </Text>
        ) : (
          <Text size="sm" className="text-muted-foreground">
            {t("invoices.navExchangeRateAudit.missingRateBody", { currency })}
          </Text>
        )}

        {report.source === "legacyImplicitOne" ? (
          <Text size="xs" className="text-muted-foreground">
            {t("invoices.navExchangeRateAudit.legacyNote")}
          </Text>
        ) : null}

        {hasAmounts ? (
          <VStack space="xs" className={isDesktop ? "w-64" : undefined}>
            <HStack space="sm" className="justify-between">
              <Text size="sm">{t("invoices.navExchangeRateAudit.reportedLabel")}</Text>
              <Text size="sm" className="font-medium">
                {reportedRateText}
              </Text>
            </HStack>
            <HStack space="sm" className="justify-between">
              <Text size="sm">{t("invoices.navExchangeRateAudit.currentLabel")}</Text>
              <Text size="sm" className="font-medium">
                {currentRateText}
              </Text>
            </HStack>
          </VStack>
        ) : null}

        {hasAmounts ? (
          <Text size="xs" className="text-muted-foreground">
            {t("invoices.navExchangeRateAudit.correctionHint")}
          </Text>
        ) : null}

        <HStack space="sm" className={isDesktop ? "self-start" : "flex-wrap"}>
          <Button
            testID="nav-exchange-rate-audit-primary-action"
            variant="outline"
            disabled={busy}
            className={`border-destructive/40 ${isDesktop ? "" : "w-full"} ${TAP_TARGET_MIN_H}`}
            onPress={hasAmounts ? onIssueCorrection : onAddRate}
          >
            <ButtonText className="text-destructive">
              {hasAmounts
                ? t("invoices.navExchangeRateAudit.issueCorrection")
                : t("invoices.navExchangeRateAudit.addRate")}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}
