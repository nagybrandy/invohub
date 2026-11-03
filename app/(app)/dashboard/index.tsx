// app/(app)/dashboard/index.tsx
// Főoldal (redesign 2026-11, SPEC §7.1): the header with the to-do summary,
// the Kintlévőség hero card beside two stat cards, "Következő lépések" built
// from real data only, and "Legutóbbi számlák". No create buttons (the
// sidebar and the tab bar own those) and no quarter switcher (the summary API
// has no period parameter). The M2M demo panel stays at the very bottom
// behind its flag.
import * as React from "react";
import { Linking, Platform, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Headphones } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { M2mDemoCard } from "@/components/dashboard/M2mDemoCard";
import { NextActionsCard, type NextActionTarget } from "@/components/dashboard/NextActionsCard";
import { OutstandingCard } from "@/components/dashboard/OutstandingCard";
import { RecentInvoices } from "@/components/dashboard/RecentInvoices";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import { computeTodoSummary } from "@/lib/dashboard/todo-summary";
import { formatAsOfDate, formatMonthLabel } from "@/lib/dashboard/period-labels";
import { formatVatPeriodLabel } from "@/lib/dashboard/vat-period";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceStatus } from "@/lib/invoices/types";
import { isM2mDemoCardVisible } from "@/lib/m2m/demo-flag";
import { routes } from "@/lib/navigation";
import {
  buildSupportDiagnostics,
  buildSupportMailtoUrl,
  getAppVersion,
  getSupportEmail,
} from "@/lib/support/contact";
import { breakpointForWidth } from "@/lib/theme/layout";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";

const CURRENCY = "HUF" as const;

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { summary, draftCount, outstandingCount, loading, refresh } = useDashboardSummary();
  const { width: windowWidth } = useWindowDimensions();
  const breakpoint = breakpointForWidth(windowWidth);
  const supportEmail = getSupportEmail();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const today = new Date();
  const language = i18n.language;
  const vatPeriod = formatVatPeriodLabel(today, language);
  const todo = computeTodoSummary({
    navFailedCount: summary.navFailedCount,
    overdueCount: summary.overdueCount,
    draftCount,
  });

  function openList(status: InvoiceStatus | "all" | NextActionTarget) {
    router.push(status === "all" ? routes.invoices : routes.invoicesFiltered(status));
  }

  async function handleDeleteInvoice(id: string) {
    await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
    await refresh();
  }

  // A minimal local toast — deliberately not components/ui/toast, which
  // pulls in react-native-reanimated and (in this environment) breaks the
  // Jest worklets mock for every test that imports this screen. Same
  // pattern as InvoiceComposer and the invoices list.
  React.useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function handleContactSupport() {
    if (!supportEmail) return;
    const diagnostics = buildSupportDiagnostics({
      locale: i18n.language,
      platform: Platform.OS,
      appVersion: getAppVersion(),
    });
    const url = buildSupportMailtoUrl({
      email: supportEmail,
      subject: t("dashboard.support.subject"),
      body: `${t("dashboard.support.bodyIntro")}\n\n\n${t("dashboard.support.diagnosticsTitle")}\n${diagnostics}`,
    });
    try {
      await Linking.openURL(url);
    } catch {
      setToastMessage(t("dashboard.support.openFailed", { email: supportEmail }));
    }
  }

  const hero = (
    <OutstandingCard
      className={breakpoint === "wide" ? "flex-1" : ""}
      outstanding={summary.outstanding}
      overdueTotal={summary.overdueTotal}
      outstandingCount={outstandingCount}
      overdueCount={summary.overdueCount}
      asOf={formatAsOfDate(today, language)}
      loading={loading}
      onOpenAll={() => openList("unpaid")}
      onOpenNotDue={() => openList("unpaid")}
      onOpenOverdue={() => openList("overdue")}
    />
  );
  const receivedCard = (
    <DashboardStatCard
      testID="dashboard-stat-received"
      label={t("home.stats.received")}
      amount={formatCurrency(summary.revenue, CURRENCY)}
      sub={t("home.stats.receivedSub", {
        month: formatMonthLabel(today, language),
        count: summary.revenuePaidCount,
      })}
      loading={loading}
    />
  );
  const vatCard = (
    <DashboardStatCard
      testID="dashboard-stat-vat"
      label={t("dashboard.kpi.estimatedVat")}
      amount={formatCurrency(Math.round(summary.estimatedVat), CURRENCY)}
      sub={vatPeriod}
      info={t("dashboard.vatPeriodNote", { period: vatPeriod })}
      infoLabel={t("home.stats.vatInfoLabel")}
      loading={loading}
    />
  );

  return (
    <ScreenLayout
      header={
        <DashboardHeader
          title={t("nav.dashboard")}
          summary={todo}
          loading={loading}
          overflowActions={
            supportEmail
              ? [
                  {
                    label: t("dashboard.customerService"),
                    icon: Headphones,
                    onPress: () => void handleContactSupport(),
                  },
                ]
              : undefined
          }
          overflowLabel={t("nav.more")}
        />
      }
    >
      <VStack space="lg">
        {breakpoint === "wide" ? (
          // >= 1100: hero 1.55fr beside the two stat cards, which stack and
          // stretch to the hero's height.
          <HStack className="items-stretch gap-4" testID="dashboard-grid">
            <Box className="min-w-0" style={{ flex: 1.55 }}>
              {hero}
            </Box>
            <VStack className="min-w-0 gap-4" style={{ flex: 1 }}>
              {receivedCard}
              {vatCard}
            </VStack>
          </HStack>
        ) : (
          // < 1100: the hero, then the two stat cards side by side.
          <VStack className="gap-4" testID="dashboard-grid">
            {hero}
            <HStack className="items-stretch gap-4">
              {receivedCard}
              {vatCard}
            </HStack>
          </VStack>
        )}

        <NextActionsCard
          navFailedCount={summary.navFailedCount}
          overdueCount={summary.overdueCount}
          overdueTotal={summary.overdueTotal}
          draftCount={draftCount}
          loading={loading}
          onSelect={openList}
          onOpenInvoice={(id) => router.push(routes.invoiceDetail(id))}
        />

        <RecentInvoices
          invoices={summary.recentInvoices}
          loading={loading}
          onOpenInvoice={(id) => router.push(routes.invoiceDetail(id))}
          onOpenAll={() => router.push(routes.invoices)}
          onDelete={handleDeleteInvoice}
        />

        {isM2mDemoCardVisible() ? <M2mDemoCard /> : null}
      </VStack>
      {toastMessage ? (
        <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="dashboard-toast">
          <Box className="rounded-control bg-navy px-4 py-2.5 shadow-tooltip">
            <Text className="text-sm font-medium text-white">{toastMessage}</Text>
          </Box>
        </Box>
      ) : null}
    </ScreenLayout>
  );
}
