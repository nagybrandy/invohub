// app/(app)/dashboard/index.tsx
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Download,
  Headphones,
  Inbox,
  MoreHorizontal,
  Plus,
} from "lucide-react-native";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { M2mDemoCard } from "@/components/dashboard/M2mDemoCard";
import { useSession } from "@/lib/auth-client";
import { useIconColors } from "@/lib/theme/icon-colors";
import { formatCurrency, calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { computeDashboardSummary } from "@/lib/dashboard/summary";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice } from "@/lib/invoices/types";

function getInvoiceGross(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice.lineItems).totalAmount;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { data: session } = useSession();
  const { invoices, loading } = useInvoices();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const computed = useMemo(() => computeDashboardSummary(invoices), [invoices]);

  const currency: Invoice["currency"] = "HUF";

  return (
    <ScreenLayout>
      <VStack space="lg" className="mx-auto w-full max-w-[1280px]">
        <Breadcrumb items={[{ label: t("dashboard.breadcrumb") }]} />
        {/* Header row */}
        <Box className="gap-4 md:flex-row md:items-start md:justify-between">
          <VStack space="xs">
            <Heading size="2xl" className="text-foreground">
              {t("nav.dashboard")}
            </Heading>
            <Text size="sm" className="text-muted-foreground">
              {t("dashboard.subtitle")}
            </Text>
          </VStack>
          {isDesktop ? (
          <HStack space="sm" className="items-center">
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push(routes.invoices)}
            >
              <Inbox size={16} color={icons.foreground} />
              <ButtonText>{t("dashboard.incomingInvoices")}</ButtonText>
              {computed.overdueCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="ml-1 rounded-full px-1.5 py-0"
                >
                  <BadgeText className="text-[10px]">
                    {computed.overdueCount}
                  </BadgeText>
                </Badge>
              ) : null}
            </Button>
            <Button variant="outline" size="sm">
              <Headphones size={16} color={icons.foreground} />
              <ButtonText>{t("dashboard.customerService")}</ButtonText>
            </Button>
          </HStack>
          ) : (
            <Button onPress={() => router.push(routes.newInvoice)}>
              <Plus size={16} color="#ffffff" />
              <ButtonText>{t("dashboard.newInvoice")}</ButtonText>
            </Button>
          )}
        </Box>

        {/* 3 equal stat cards */}
        <Box className="flex-col gap-4 md:flex-row">
          <RevenueCard
            loading={loading}
            revenue={computed.revenue}
            paid={computed.revenue}
            issued={computed.issuedTotal}
            outstanding={computed.outstanding}
            currency={currency}
          />
          <VatCard
            loading={loading}
            estimatedVat={computed.estimatedVat}
            currency={currency}
          />
          <OverdueCard
            loading={loading}
            outstanding={computed.overdueTotal}
            overdueCount={computed.overdueCount}
            oldestDays={computed.oldestOverdueDays}
            currency={currency}
          />
        </Box>

        {/* Recent Invoices */}
        <VStack space="sm">
          <HStack className="items-center justify-between">
            <Heading size="lg" className="text-foreground">
              {t("dashboard.recentInvoices")}
            </Heading>
            <Pressable onPress={() => router.push(routes.invoices)}>
              <Text size="sm" className="font-medium text-primary">
                {t("dashboard.allOutgoing")} →
              </Text>
            </Pressable>
          </HStack>

          {isDesktop ? (
            <InvoiceTable
              invoices={computed.recentInvoices}
              loading={loading}
              icons={icons}
            />
          ) : (
            <InvoiceCards
              invoices={computed.recentInvoices}
              loading={loading}
            />
          )}
        </VStack>

        <M2mDemoCard />

      </VStack>
    </ScreenLayout>
  );
}

/* ─── Revenue Stat Card ───────────────────────────────────── */

function RevenueCard({
  loading,
  revenue,
  paid,
  issued,
  outstanding,
  currency,
}: {
  loading: boolean;
  revenue: number;
  paid: number;
  issued: number;
  outstanding: number;
  currency: Invoice["currency"];
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex-1 p-5">
      <VStack space="sm">
        <Text size="sm" className="font-light text-muted-foreground">
          {t("dashboard.revenueStats")}
        </Text>
        <Text className="text-2xl font-bold text-foreground">
          {loading ? "…" : formatCurrency(revenue, currency)}
        </Text>
        <VStack space="xs">
          <HStack space="sm" className="items-center">
            <Box className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <Text size="xs" className="font-light text-muted-foreground">
              {t("dashboard.paid")}:{" "}
              {loading ? "…" : formatCurrency(paid, currency)}
            </Text>
          </HStack>
          <HStack space="sm" className="items-center">
            <Box className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <Text size="xs" className="font-light text-muted-foreground">
              {t("dashboard.issued")}:{" "}
              {loading ? "…" : formatCurrency(issued, currency)}
            </Text>
          </HStack>
          <HStack space="sm" className="items-center">
            <Box className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            <Text size="xs" className="font-light text-muted-foreground">
              {t("dashboard.outstanding")}:{" "}
              {loading ? "…" : formatCurrency(outstanding, currency)}
            </Text>
          </HStack>
        </VStack>
      </VStack>
    </Card>
  );
}

/* ─── Estimated VAT Card ──────────────────────────────────── */

function VatCard({
  loading,
  estimatedVat,
  currency,
}: {
  loading: boolean;
  estimatedVat: number;
  currency: Invoice["currency"];
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex-1 p-5">
      <VStack space="sm">
        <Text size="sm" className="font-light text-muted-foreground">
          {t("dashboard.estimatedVat")}
        </Text>
        <Text className="text-2xl font-bold text-foreground">
          {loading
            ? "…"
            : formatCurrency(Math.round(estimatedVat), currency)}
        </Text>
        <Text size="xs" className="font-light text-muted-foreground">
          {t("dashboard.vatPeriodNote")}
        </Text>
      </VStack>
    </Card>
  );
}

/* ─── Overdue Debt Card ───────────────────────────────────── */

function OverdueCard({
  loading,
  outstanding,
  overdueCount,
  oldestDays,
  currency,
}: {
  loading: boolean;
  outstanding: number;
  overdueCount: number;
  oldestDays: number;
  currency: Invoice["currency"];
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex-1 p-5">
      <VStack space="sm">
        <Text size="sm" className="font-light text-muted-foreground">
          {t("dashboard.overdueDebt")}
        </Text>
        <Text className="text-2xl font-bold text-destructive">
          {loading ? "…" : formatCurrency(outstanding, currency)}
        </Text>
        <Text size="xs" className="font-light text-muted-foreground">
          {loading
            ? "…"
            : t("dashboard.overdueDetail", {
                count: overdueCount,
                days: oldestDays,
              })}
        </Text>
      </VStack>
    </Card>
  );
}

/* ─── Invoice Table (Desktop) ─────────────────────────────── */

function InvoiceTable({
  invoices,
  loading,
  icons,
}: {
  invoices: Invoice[];
  loading: boolean;
  icons: ReturnType<typeof useIconColors>;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Card className="p-6">
        <Text className="text-muted-foreground">{t("common.loading")}</Text>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card className="p-6">
        <Text className="text-muted-foreground">
          {t("dashboard.table.noInvoices")}
        </Text>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* Table header */}
      <HStack className="border-b border-border bg-muted/30 px-4 py-3">
        <Box className="w-[40px]" />
        <Text
          size="xs"
          className="w-[120px] font-medium text-muted-foreground"
        >
          {t("dashboard.table.serialNumber")}
        </Text>
        <Text size="xs" className="flex-1 font-medium text-muted-foreground">
          {t("dashboard.table.partner")}
        </Text>
        <Text
          size="xs"
          className="w-[110px] font-medium text-muted-foreground"
        >
          {t("dashboard.table.paymentStatus")}
        </Text>
        <Text
          size="xs"
          className="w-[50px] text-center font-medium text-muted-foreground"
        >
          NAV
        </Text>
        <Text
          size="xs"
          className="w-[80px] font-medium text-muted-foreground"
        >
          {t("dashboard.table.sentDate")}
        </Text>
        <Text
          size="xs"
          className="w-[90px] font-medium text-muted-foreground"
        >
          {t("dashboard.table.dateIssued")}
        </Text>
        <Text
          size="xs"
          className="w-[120px] text-right font-medium text-muted-foreground"
        >
          {t("dashboard.table.grossAmount")}
        </Text>
        <Box className="w-[70px]" />
      </HStack>

      {/* Table rows */}
      {invoices.map((inv) => (
        <InvoiceRow key={inv.id} invoice={inv} icons={icons} />
      ))}
    </Card>
  );
}

function InvoiceRow({
  invoice,
  icons,
}: {
  invoice: Invoice;
  icons: ReturnType<typeof useIconColors>;
}) {
  const { t } = useTranslation();
  const gross = getInvoiceGross(invoice);
  const statusLabel = t(getStatusI18nKey(invoice.status));
  const statusColor = getStatusColor(invoice.status);

  return (
    <Pressable onPress={() => router.push(routes.invoiceDetail(invoice.id))}>
      <HStack className="items-center border-b border-border px-4 py-3 last:border-b-0">
        {/* Checkbox placeholder */}
        <Box className="w-[40px]">
          <Box className="h-4 w-4 rounded border border-border" />
        </Box>
        <Text size="sm" className="w-[120px] font-medium text-foreground">
          {invoice.invoiceNumber}
        </Text>
        <Text size="sm" className="flex-1 text-foreground">
          {invoice.clientName}
        </Text>
        <Box className="w-[110px]">
          <Badge
            variant="outline"
            className={`self-start rounded-full ${statusColor}`}
          >
            <BadgeText className={`text-[10px] normal-case ${statusColor}`}>
              {statusLabel}
            </BadgeText>
          </Badge>
        </Box>
        <Box className="w-[50px] items-center">
          <Box
            className={`h-3 w-3 rounded-full ${
              invoice.status === "paid"
                ? "bg-green-500"
                : "bg-muted-foreground/30"
            }`}
          />
        </Box>
        <Text size="xs" className="w-[80px] font-light text-muted-foreground">
          {invoice.status === "sent" || invoice.status === "paid"
            ? invoice.issueDate.slice(0, 10)
            : "—"}
        </Text>
        <Text size="sm" className="w-[90px] font-light text-muted-foreground">
          {invoice.issueDate.slice(0, 10)}
        </Text>
        <Text
          size="sm"
          className="w-[120px] text-right font-medium text-foreground"
        >
          {formatCurrency(gross, invoice.currency)}
        </Text>
        <HStack space="xs" className="w-[70px] justify-end">
          <Pressable>
            <Download size={16} color={icons.muted} />
          </Pressable>
          <Pressable>
            <MoreHorizontal size={16} color={icons.muted} />
          </Pressable>
        </HStack>
      </HStack>
    </Pressable>
  );
}

/* ─── Invoice Cards (Mobile) ──────────────────────────────── */

function InvoiceCards({
  invoices,
  loading,
}: {
  invoices: Invoice[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Card className="p-4">
        <Text className="text-muted-foreground">{t("common.loading")}</Text>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card className="p-4">
        <Text className="text-muted-foreground">
          {t("dashboard.table.noInvoices")}
        </Text>
      </Card>
    );
  }

  return (
    <VStack space="sm">
      {invoices.map((inv) => {
        const gross = getInvoiceGross(inv);
        const statusLabel = t(getStatusI18nKey(inv.status));
        const statusColor = getStatusColor(inv.status);

        return (
          <Pressable
            key={inv.id}
            onPress={() => router.push(routes.invoiceDetail(inv.id))}
          >
            <Card className="p-4">
              <HStack className="items-center justify-between">
                <VStack space="xs">
                  <Text size="sm" className="font-medium text-foreground">
                    {inv.invoiceNumber}
                  </Text>
                  <Text size="xs" className="font-light text-muted-foreground">
                    {inv.clientName}
                  </Text>
                </VStack>
                <VStack space="xs" className="items-end">
                  <Text size="sm" className="font-medium text-foreground">
                    {formatCurrency(gross, inv.currency)}
                  </Text>
                  <Badge
                    variant="outline"
                    className={`rounded-full ${statusColor}`}
                  >
                    <BadgeText
                      className={`text-[10px] normal-case ${statusColor}`}
                    >
                      {statusLabel}
                    </BadgeText>
                  </Badge>
                </VStack>
              </HStack>
            </Card>
          </Pressable>
        );
      })}
    </VStack>
  );
}

/* ─── Helpers ─────────────────────────────────────────────── */

function getStatusI18nKey(status: Invoice["status"]): string {
  switch (status) {
    case "paid":
      return "dashboard.table.statusPaid";
    case "overdue":
      return "dashboard.table.statusOverdue";
    case "sent":
      return "invoices.status.sent";
    case "draft":
      return "invoices.status.draft";
    case "proforma":
      return "invoices.proforma";
    case "cancelled":
      return "invoices.status.cancelled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function getStatusColor(status: Invoice["status"]): string {
  switch (status) {
    case "paid":
      return "border-green-500 text-green-700";
    case "overdue":
      return "border-red-500 text-red-600";
    case "sent":
      return "border-blue-500 text-blue-600";
    case "draft":
      return "border-muted-foreground text-muted-foreground";
    case "proforma":
      return "border-orange-500 text-orange-600";
    case "cancelled":
      return "border-muted-foreground/50 text-muted-foreground/50";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
