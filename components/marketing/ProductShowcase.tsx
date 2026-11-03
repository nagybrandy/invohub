// components/marketing/ProductShowcase.tsx
// A miniature of the new app for the landing hero (SPEC §10.5): a card with a
// tiny navy sidebar strip, a KPI strip and three table rows with status pills.
// Everything in it is sample data and says so (`landing.product.sampleData`);
// the whole illustration is one image for assistive technology.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileText, LayoutDashboard, Send, Users } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ShowcasePill } from "@/components/marketing/ShowcasePill";
import { SAMPLE_INVOICES, SAMPLE_KPIS } from "@/components/marketing/sample-data";
import { useIconColors } from "@/lib/theme/icon-colors";
import { type } from "@/lib/ui/type";

type ProductShowcaseProps = {
  /** Phone form: no sidebar strip. */
  compact: boolean;
};

export function ProductShowcase({ compact }: ProductShowcaseProps) {
  const { t } = useTranslation();
  const icons = useIconColors();

  const kpis = [
    { key: "period", label: t("landing.product.currentPeriod"), value: SAMPLE_KPIS.period },
    { key: "paid", label: t("landing.product.paid"), value: SAMPLE_KPIS.paid },
    { key: "sent", label: t("landing.product.sent"), value: SAMPLE_KPIS.sent },
  ];

  return (
    <Box
      testID="landing-product-showcase"
      accessibilityRole="image"
      accessibilityLabel={`${t("landing.product.workspace")} · ${t("landing.product.sampleData")}`}
      className="w-full min-w-0"
    >
      <Box
        testID="showcase-content"
        aria-hidden={true}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="max-w-full flex-row overflow-hidden rounded-card border border-line bg-surface shadow-dialog"
      >
        {!compact ? (
          <VStack
            testID="showcase-sidebar"
            className="w-[52px] items-center gap-2 bg-navy py-3"
          >
            <Box className="mb-2 h-[22px] w-[22px] rounded-[6px] bg-primary" />
            {[LayoutDashboard, FileText, Users].map((Icon, index) => (
              <Box
                key={index}
                className={`h-8 w-8 items-center justify-center rounded-control ${
                  index === 0 ? "bg-white/10" : ""
                }`}
              >
                <Icon size={15} color={index === 0 ? icons.onNavyActive : icons.onNavy} />
              </Box>
            ))}
          </VStack>
        ) : null}

        <VStack className="min-w-0 flex-1 gap-3 p-3 tab:p-4">
          <HStack className="items-center justify-between gap-2">
            <Text className="min-w-0 flex-shrink text-[13px] font-semibold text-ink" numberOfLines={1}>
              {t("landing.product.workspace")}
            </Text>
            <Box className="flex-shrink-0 rounded-full bg-neutral-wash px-2.5 py-0.5">
              <Text className="text-[11px] font-medium text-muted-ink">
                {t("landing.product.sampleData")}
              </Text>
            </Box>
          </HStack>

          <HStack className="gap-2">
            {kpis.map((kpi) => (
              <VStack
                key={kpi.key}
                className="min-w-0 flex-1 rounded-control border border-line px-2.5 py-2"
              >
                <Text className="text-[11px] text-muted-ink" numberOfLines={1}>
                  {kpi.label}
                </Text>
                <Text className={`text-xs font-bold text-ink tab:text-[13px] ${type.money}`}>
                  {kpi.value}
                </Text>
              </VStack>
            ))}
          </HStack>

          <Box className="overflow-hidden rounded-control border border-line">
            <HStack className="items-center justify-between bg-wash2 px-3 py-2">
              <Text className="text-xs font-semibold text-muted-ink">
                {t("landing.product.recent")}
              </Text>
              <Text className="text-xs font-medium text-primary">
                {t("landing.product.allInvoices")}
              </Text>
            </HStack>
            {SAMPLE_INVOICES.map((invoice) => (
              <HStack
                key={invoice.id}
                className="items-center gap-3 border-t border-line px-3 py-2.5"
              >
                <VStack className="min-w-0 flex-1">
                  <Text className="text-[13px] text-ink" numberOfLines={1}>
                    {invoice.id}
                  </Text>
                  <Text className="text-xs text-muted-ink" numberOfLines={1}>
                    {invoice.client}
                  </Text>
                </VStack>
                <VStack className="items-end gap-1">
                  <Text className={`text-[13px] font-bold text-ink ${type.money}`}>
                    {invoice.amount}
                  </Text>
                  <ShowcasePill status={invoice.status} />
                </VStack>
              </HStack>
            ))}
          </Box>

          <HStack className="items-center gap-2.5 rounded-control bg-wash2 px-3 py-2.5">
            <Box className="h-8 w-8 items-center justify-center rounded-[9px] bg-primary-wash">
              <Send size={15} color={icons.primary} />
            </Box>
            <VStack className="min-w-0 flex-1">
              <Text className="text-xs font-semibold text-ink" numberOfLines={1}>
                {t("landing.product.deliveryTitle")}
              </Text>
              <Text className="text-xs text-muted-ink" numberOfLines={2}>
                {t("landing.product.deliveryDetail")}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
