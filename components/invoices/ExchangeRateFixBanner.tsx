// components/invoices/ExchangeRateFixBanner.tsx
// Surfaces non-HUF invoices with no usable stored HUF exchange rate on
// /invoices (plan docs/plans/2026-09-18-backfill-non-huf-invoices-missing-
// exchange-rate.md AC4). Purely presentational — the screen owns the
// filter state and passes it in.
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Box } from "@/components/ui/box";
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
    <Text size="sm" className="flex-1 text-warn">
      {active
        ? t("invoices.exchangeRateFix.activeTitle")
        : t("invoices.exchangeRateFix.banner", { count })}
    </Text>
  );

  const action = (
    <Button
      variant="secondary"
      className={isDesktop ? TAP_TARGET_MIN_H : `w-full ${TAP_TARGET_MIN_H}`}
      onPress={onPress}
      testID="exchange-rate-fix-banner-action"
    >
      <ButtonText>{label}</ButtonText>
    </Button>
  );

  return (
    // A warn note (redesign 2026-11), not an error: the invoices still exist,
    // they only cannot be sent to NAV until a HUF rate is stored.
    <Box testID="exchange-rate-fix-banner" className="rounded-card bg-warn-wash px-3.5 py-2.5">
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
    </Box>
  );
}
