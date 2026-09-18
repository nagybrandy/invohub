// components/receipts/ReceiptNavCard.tsx
// Pure extraction of the NAV status card from the receipt detail screen
// (app/(app)/receipts/[id]/index.tsx), plus the navReceiptErrorI18nKey
// fallback render: a known blocked-reason code (e.g. "missing_exchange_rate")
// renders through t() in the viewer's language, interpolated with the
// receipt's own currency; anything else (NAV's own verbatim error text) is
// untrusted server data and renders as-is, unchanged.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { navReceiptErrorI18nKey } from "@/lib/receipts/nav-error-code";

export type ReceiptNavCardProps = {
  navSubmitted: boolean;
  navMode: "demo" | "test" | "production";
  navReportId: string | null;
  navError: string | null;
  currency: string;
};

export function ReceiptNavCard({
  navSubmitted,
  navMode,
  navReportId,
  navError,
  currency,
}: ReceiptNavCardProps) {
  const { t } = useTranslation();

  const errorKey = navReceiptErrorI18nKey(navError);
  const errorText = errorKey ? t(errorKey, { currency }) : navError;

  return (
    <Card className="p-4">
      <VStack space="sm">
        <HStack className="items-center justify-between">
          <Text size="sm" className="text-muted-foreground">NAV</Text>
          {navSubmitted ? (
            <Badge variant="outline" className="rounded-full border-green-500 px-2 py-0.5">
              <BadgeText className="text-xs text-green-600">{t("receipts.navSubmitted")}</BadgeText>
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full px-2 py-0.5">
              <BadgeText className="text-xs text-muted-foreground">{t("receipts.navPending")}</BadgeText>
            </Badge>
          )}
        </HStack>
        <HStack className="items-center justify-between">
          <Badge variant="outline" className="rounded-full px-2 py-0.5">
            <BadgeText className="text-xs text-muted-foreground">
              {navMode === "test" ? t("receipts.navModeTest") : t("receipts.navModeDemo")}
            </BadgeText>
          </Badge>
          <Text size="xs" className="flex-1 text-right text-muted-foreground">
            {navMode === "test" ? t("receipts.navTestHint") : t("receipts.navDemoHint")}
          </Text>
        </HStack>
        {navReportId ? (
          <HStack className="justify-between">
            <Text size="sm" className="text-muted-foreground">
              {t("receipts.navReportId")}
            </Text>
            <Text selectable size="xs" className="flex-1 text-right font-mono">
              {navReportId}
            </Text>
          </HStack>
        ) : null}
        {navError ? (
          <VStack space="xs">
            <Text size="xs" className="text-muted-foreground">
              {t("receipts.navReportError")}
            </Text>
            <Text size="xs" className="text-destructive">
              {errorText}
            </Text>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
