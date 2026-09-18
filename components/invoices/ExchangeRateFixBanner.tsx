// components/invoices/ExchangeRateFixBanner.tsx
// Surfaces non-HUF invoices with no usable stored HUF exchange rate on
// /invoices (plan docs/plans/2026-09-18-backfill-non-huf-invoices-missing-
// exchange-rate.md AC4). Purely presentational — the screen owns the
// filter state and passes it in.
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
import { useIsDesktop } from "@/lib/useIsDesktop";

export type ExchangeRateFixBannerProps = {
  /** Count of affected invoices — irrelevant while `active` (see AC4.1/4's "no banner at 0"). */
  count: number;
  /** True when the list is already showing only the affected invoices. */
  active: boolean;
  onShowAffected: () => void;
  onShowAll: () => void;
};

export function ExchangeRateFixBanner({
  count,
  active,
  onShowAffected,
  onShowAll,
}: ExchangeRateFixBannerProps) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  if (count === 0 && !active) {
    return null;
  }

  const label = active ? t("invoices.exchangeRateFix.showAll") : t("invoices.exchangeRateFix.showAffected");
  const onPress = active ? onShowAll : onShowAffected;

  const text = (
    <Text size="sm" className="flex-1 text-destructive">
      {active
        ? t("invoices.exchangeRateFix.activeTitle")
        : t("invoices.exchangeRateFix.banner", { count })}
    </Text>
  );

  const action = (
    <Button
      variant="outline"
      className={
        isDesktop
          ? `border-destructive/40 ${TAP_TARGET_MIN_H}`
          : `border-destructive/40 w-full ${TAP_TARGET_MIN_H}`
      }
      onPress={onPress}
      testID="exchange-rate-fix-banner-action"
    >
      <ButtonText className="text-destructive">{label}</ButtonText>
    </Button>
  );

  return (
    <Card
      testID="exchange-rate-fix-banner"
      className="border border-destructive/40 bg-destructive/10 p-3"
    >
      {isDesktop ? (
        <HStack space="md" className="items-center justify-between">
          {text}
          {action}
        </HStack>
      ) : (
        <VStack space="sm">
          {text}
          {action}
        </VStack>
      )}
    </Card>
  );
}
