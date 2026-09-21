// app/(app)/dashboard/index.tsx
// Vezérlőpult: 4 clickable KPIs that link to the matching filtered invoice
// list (A4), a "Következő lépések" card, a real chart instead of a
// colour-legend with nothing behind it (A5), an honest VAT caption that
// names the period (A3), and the M2M dev-diagnostics panel collapsed at
// the very bottom (A2). Recent invoices reuse the same InvoiceListTable
// the /invoices screen uses — one visual language, not two (A1, L1).
import * as React from "react";
import { Linking, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Headphones } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceListTable } from "@/components/invoices/InvoiceListTable";
import { NextActionsCard } from "@/components/dashboard/NextActionsCard";
import { M2mDemoCard } from "@/components/dashboard/M2mDemoCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { Section } from "@/components/layout/Section";
import { StatCard } from "@/components/layout/StatCard";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatVatPeriodLabel } from "@/lib/dashboard/vat-period";
import { useIsDesktop } from "@/lib/useIsDesktop";
import {
  buildSupportDiagnostics,
  buildSupportMailtoUrl,
  getAppVersion,
  getSupportEmail,
} from "@/lib/support/contact";
import type { InvoiceStatus } from "@/lib/invoices/types";

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { summary, draftCount, outstandingCount, paidCount, loading, refresh } =
    useDashboardSummary();
  const isDesktop = useIsDesktop();
  const supportEmail = getSupportEmail();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const currency = "HUF" as const;
  const vatPeriod = formatVatPeriodLabel(new Date(), i18n.language);

  function goTo(status: InvoiceStatus | "all") {
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

  const revenueTotal = summary.revenue + summary.outstanding;
  const paidShare = revenueTotal > 0 ? summary.revenue / revenueTotal : 0;
  const outstandingShare = revenueTotal > 0 ? summary.outstanding / revenueTotal : 0;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("nav.dashboard")}
          subtitle={t("dashboard.subtitle")}
          primaryAction={
            isDesktop ? undefined : (
              <Button onPress={() => router.push(routes.newInvoice)}>
                <ButtonText>{t("dashboard.newInvoice")}</ButtonText>
              </Button>
            )
          }
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
        {/* 4 clickable KPIs (A4) */}
        <Box className="flex-col gap-4 md:flex-row">
          <StatCard
            label={t("dashboard.kpi.outstanding")}
            value={loading ? "…" : formatCurrency(summary.outstanding, currency)}
            hint={t("dashboard.kpi.invoiceCount", { count: outstandingCount ?? 0 })}
            onPress={() => goTo("unpaid")}
            loading={loading}
          />
          <StatCard
            label={t("dashboard.kpi.overdue")}
            value={loading ? "…" : formatCurrency(summary.overdueTotal, currency)}
            tone="critical"
            hint={
              summary.oldestOverdueDays < 1
                ? t("dashboard.kpi.overdueHintToday", { count: summary.overdueCount })
                : t("dashboard.kpi.overdueHint", { count: summary.overdueCount, days: summary.oldestOverdueDays })
            }
            onPress={() => goTo("overdue")}
            loading={loading}
          />
          <StatCard
            label={t("dashboard.kpi.revenueThisMonth")}
            value={loading ? "…" : formatCurrency(summary.revenue, currency)}
            hint={t("dashboard.kpi.invoiceCount", { count: paidCount ?? 0 })}
            onPress={() => goTo("paid")}
            loading={loading}
          />
          <StatCard
            label={t("dashboard.kpi.estimatedVat")}
            value={loading ? "…" : formatCurrency(Math.round(summary.estimatedVat), currency)}
            hint={t("dashboard.vatPeriodNote", { period: vatPeriod })}
            onPress={() => goTo("all")}
            loading={loading}
          />
        </Box>

        <NextActionsCard
          overdueCount={summary.overdueCount}
          draftCount={draftCount}
          loading={loading}
          onSelect={goTo}
        />

        {/* Revenue split — a real chart, not a legend without one (A5). No orange. */}
        <Section title={t("dashboard.revenueStats")}>
          <VStack space="sm">
            <HStack className="h-2 overflow-hidden rounded-full bg-muted" testID="dashboard-revenue-bar">
              <Box className="h-full bg-[#15803d]" style={{ width: `${paidShare * 100}%` }} />
              <Box className="h-full bg-primary" style={{ width: `${outstandingShare * 100}%` }} />
            </HStack>
            <HStack space="md" className="flex-wrap">
              <HStack space="xs" className="items-center">
                <Box className="h-2.5 w-2.5 rounded-full bg-[#15803d]" />
                <Text size="xs" className="text-muted-foreground">
                  {t("dashboard.paid")}: {formatCurrency(summary.revenue, currency)}
                </Text>
              </HStack>
              <HStack space="xs" className="items-center">
                <Box className="h-2.5 w-2.5 rounded-full bg-primary" />
                <Text size="xs" className="text-muted-foreground">
                  {t("dashboard.outstanding")}: {formatCurrency(summary.outstanding, currency)}
                </Text>
              </HStack>
            </HStack>
          </VStack>
        </Section>

        {/* Recent invoices — same visual language as /invoices (A1, L1) */}
        <VStack space="sm">
          <HStack className="items-center justify-between">
            <Text className="font-heading text-lg font-semibold text-foreground">
              {t("dashboard.recentInvoices")}
            </Text>
            <Pressable onPress={() => router.push(routes.invoices)}>
              <Text size="sm" className="font-medium text-primary">
                {t("dashboard.allOutgoing")} →
              </Text>
            </Pressable>
          </HStack>

          {isDesktop ? (
            <InvoiceListTable
              invoices={summary.recentInvoices}
              loading={loading}
              onRowPress={(inv) => router.push(routes.invoiceDetail(inv.id))}
              menuItemsFor={() => []}
              empty={<Text className="p-4 text-muted-foreground">{t("dashboard.table.noInvoices")}</Text>}
            />
          ) : (
            <VStack space="sm">
              {summary.recentInvoices.length === 0 ? (
                <Text className="text-muted-foreground">{t("dashboard.table.noInvoices")}</Text>
              ) : (
                summary.recentInvoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onDelete={handleDeleteInvoice}
                    onPress={(inv) => router.push(routes.invoiceDetail(inv.id))}
                  />
                ))
              )}
            </VStack>
          )}
        </VStack>

        <M2mDemoCard />
      </VStack>
      {toastMessage ? (
        <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="dashboard-toast">
          <Box className="rounded-lg bg-foreground px-4 py-2.5 shadow-lg">
            <Text className="text-sm font-medium text-background">{toastMessage}</Text>
          </Box>
        </Box>
      ) : null}
    </ScreenLayout>
  );
}
