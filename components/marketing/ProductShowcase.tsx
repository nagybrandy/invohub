// components/marketing/ProductShowcase.tsx
// Layered product preview showing the current dashboard-to-payment workflow.
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Send,
  Users,
} from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { landingColors } from "@/components/marketing/landing-theme";

type ProductShowcaseProps = {
  compact: boolean;
};

export function ProductShowcase({ compact }: ProductShowcaseProps) {
  const { t } = useTranslation();
  const invoices = [
    {
      id: "INV-2026-0142",
      client: "Minta Stúdió Kft.",
      amount: "248 920 Ft",
      state: t("landing.product.paid"),
      paid: true,
    },
    {
      id: "INV-2026-0141",
      client: "Kék Duna Bt.",
      amount: "86 400 Ft",
      state: t("landing.product.sent"),
      paid: false,
    },
    {
      id: "INV-2026-0140",
      client: "Northwind Kft.",
      amount: "174 600 Ft",
      state: t("landing.product.draft"),
      paid: false,
    },
  ];

  return (
    <Box
      className={`${compact ? "w-full" : "w-[58%]"} relative pb-5 pt-2 md:pb-8`}
      testID="landing-product-showcase"
    >
      <Box className="absolute bottom-0 left-5 right-0 top-8 rounded-[24px] bg-primary/20" />
      <Box className="relative overflow-hidden rounded-[24px] border border-white/15 bg-[#f7f9fc] shadow-2xl">
        <HStack className="items-center justify-between bg-[#1f305e] px-4 py-3 md:px-5">
          <HStack space="sm" className="items-center">
            <Box className="h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <LayoutDashboard size={16} color={landingColors.paleBlue} />
            </Box>
            <VStack>
              <Text size="xs" className="font-semibold text-white">
                {t("landing.product.workspace")}
              </Text>
              <Text className="text-[10px] text-[#b9c6df]">
                {t("landing.product.sampleData")}
              </Text>
            </VStack>
          </HStack>
          <Box className="h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <BellRing size={14} color={landingColors.white} />
          </Box>
        </HStack>

        <Box className={`${compact ? "" : "flex-row"} min-w-0`}>
          {!compact ? (
            <VStack className="w-[144px] bg-[#edf2fa] p-3" space="xs">
              {[
                [LayoutDashboard, t("landing.product.overview")],
                [FileText, t("landing.product.invoices")],
                [Users, t("landing.product.clients")],
              ].map(([Icon, label], index) => (
                <HStack
                  key={String(label)}
                  space="sm"
                  className={`items-center rounded-lg px-2 py-2 ${
                    index === 0 ? "bg-white" : ""
                  }`}
                >
                  <Icon
                    size={14}
                    color={index === 0 ? landingColors.cornflower : landingColors.muted}
                  />
                  <Text className="text-[11px] font-medium text-[#34405a]">{String(label)}</Text>
                </HStack>
              ))}
            </VStack>
          ) : null}

          <VStack className="min-w-0 flex-1 p-3 md:p-5" space="md">
            <HStack className="items-end justify-between">
              <VStack space="xs">
                <Text className="text-[10px] font-semibold uppercase tracking-widest text-[#697386]">
                  {t("landing.product.currentPeriod")}
                </Text>
                <Text className="text-xl font-bold tracking-tight text-secondary md:text-2xl">
                  1 284 500 Ft
                </Text>
              </VStack>
              <Box className="rounded-lg bg-[#e7f6ec] px-2.5 py-1.5">
                <HStack space="xs" className="items-center">
                  <Check size={12} color={landingColors.success} />
                  <Text className="text-[10px] font-semibold text-[#166534]">
                    {t("landing.product.upToDate")}
                  </Text>
                </HStack>
              </Box>
            </HStack>

            <Box className="overflow-hidden rounded-2xl border border-[#dfe5ef] bg-white">
              <HStack className="items-center justify-between border-b border-[#e7ebf2] px-3 py-2.5 md:px-4">
                <Text size="xs" className="font-semibold text-secondary">
                  {t("landing.product.recent")}
                </Text>
                <Text className="text-[10px] font-medium text-primary">
                  {t("landing.product.allInvoices")}
                </Text>
              </HStack>
              {invoices.slice(0, compact ? 2 : 3).map((invoice) => (
                <HStack
                  key={invoice.id}
                  className="items-center border-b border-[#edf0f5] px-3 py-3 last:border-b-0 md:px-4"
                >
                  <VStack className="min-w-0 flex-1">
                    <Text className="text-[11px] font-semibold text-[#27334c]">{invoice.id}</Text>
                    <Text numberOfLines={1} className="text-[10px] text-[#697386]">
                      {invoice.client}
                    </Text>
                  </VStack>
                  <VStack className="items-end">
                    <Text className="text-[11px] font-semibold text-secondary">{invoice.amount}</Text>
                    <Text
                      className={`text-[10px] font-medium ${
                        invoice.paid ? "text-[#15803d]" : "text-[#697386]"
                      }`}
                    >
                      {invoice.state}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </Box>
          </VStack>
        </Box>
      </Box>

      <Box className="relative -mt-4 ml-4 mr-2 rounded-2xl border border-[#dce3ef] bg-white p-3 shadow-lg md:ml-auto md:mr-5 md:w-[66%] md:p-4">
        <HStack className="items-center justify-between">
          <HStack space="sm" className="min-w-0 flex-1 items-center">
            <Box className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Send size={16} color={landingColors.cornflower} />
            </Box>
            <VStack className="min-w-0 flex-1">
              <Text className="text-[11px] font-semibold text-secondary">
                {t("landing.product.deliveryTitle")}
              </Text>
              <Text numberOfLines={1} className="text-[10px] text-[#697386]">
                {t("landing.product.deliveryDetail")}
              </Text>
            </VStack>
          </HStack>
          <ChevronRight size={16} color={landingColors.cornflower} />
        </HStack>
      </Box>
    </Box>
  );
}
