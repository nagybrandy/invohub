// components/dashboard/M2mDemoCard.tsx
// Dashboard card showing a NAV M2M Adózó snapshot: demo (simulator, default,
// zero setup) or test (real m2m-dev.nav.gov.hu registry) when M2M_* env is
// configured on the server.
import * as React from "react";
import { RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useM2mDemo } from "@/hooks/useM2mDemo";
import { formatCurrency } from "@/lib/invoices/calculations";
import { useIconColors } from "@/lib/theme/icon-colors";

function CheckRow({ label, ok, code }: { label: string; ok: boolean; code?: string }) {
  return (
    <HStack className="items-center justify-between">
      <Text size="sm" className="text-foreground">
        {label}
      </Text>
      <Text size="sm" className={ok ? "text-green-600" : "text-destructive"}>
        {ok ? "OK" : (code ?? "—")}
      </Text>
    </HStack>
  );
}

export function M2mDemoCard() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { snapshot, mode, loading, error, load } = useM2mDemo();

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRefresh() {
    void load(Date.now());
  }

  const isDemo = mode === "demo";

  return (
    <Card className="border-primary/20 bg-primary/5 p-4">
      <VStack space="md">
        <HStack className="items-start justify-between">
          <VStack space="xs" className="flex-1">
            <HStack space="xs" className="items-center flex-wrap">
              <Text className="font-semibold text-foreground">
                {isDemo ? t("dashboard.m2m.titleDemo") : t("dashboard.m2m.titleTest")}
              </Text>
              {isDemo ? (
                <Badge variant="outline" className="border-primary/40">
                  <BadgeText className="text-[10px] text-primary">{t("dashboard.m2m.demoBadge")}</BadgeText>
                </Badge>
              ) : null}
            </HStack>
            <Text size="sm" className="text-muted-foreground">
              {isDemo ? t("dashboard.m2m.subtitleDemo") : t("dashboard.m2m.subtitleTest")}
            </Text>
          </VStack>
          <Button size="sm" variant="outline" onPress={handleRefresh} isDisabled={loading}>
            <RefreshCw size={14} color={icons.muted} />
            <ButtonText className="ml-1">{t("dashboard.m2m.refresh")}</ButtonText>
          </Button>
        </HStack>

        {loading && !snapshot ? <Text size="sm">{t("dashboard.m2m.loading")}</Text> : null}

        {error ? (
          <Text size="sm" className="text-destructive">
            {error}
          </Text>
        ) : null}

        {snapshot ? (
          <VStack space="sm">
            <VStack space="xs">
              <Text className="font-medium text-foreground">{snapshot.taxpayer.label}</Text>
              <Text size="sm" className="text-muted-foreground">
                ID {snapshot.taxpayer.id}
                {snapshot.taxpayer.hint ? ` · ${snapshot.taxpayer.hint}` : ""}
              </Text>
              {snapshot.detailedTaxpayer?.name ? (
                <Text size="sm" className="text-foreground">
                  {snapshot.detailedTaxpayer.name}
                </Text>
              ) : null}
            </VStack>

            <VStack space="xs" className="rounded-md bg-background/80 p-3">
              <Text size="sm" className="font-medium text-foreground">
                {t("dashboard.m2m.checksLabel")}
              </Text>
              {snapshot.checks.map((check) => (
                <CheckRow key={check.name} label={check.name} ok={check.ok} code={check.resultCode} />
              ))}
            </VStack>

            {snapshot.taxSummary ? (
              <HStack space="md" className="flex-wrap">
                <VStack>
                  <Text size="xs" className="text-muted-foreground">
                    {t("dashboard.m2m.balance")}
                  </Text>
                  <Text size="sm" className="font-medium">
                    {formatCurrency(snapshot.taxSummary.totalBalance, "HUF")}
                  </Text>
                </VStack>
                <VStack>
                  <Text size="xs" className="text-muted-foreground">
                    {t("dashboard.m2m.debt")}
                  </Text>
                  <Text size="sm" className="font-medium">
                    {formatCurrency(snapshot.taxSummary.taxDebt, "HUF")}
                  </Text>
                </VStack>
              </HStack>
            ) : null}

            {snapshot.missingDeclarations.length > 0 ? (
              <Text size="sm" className="text-foreground">
                {t("dashboard.m2m.missingDeclarations", { count: snapshot.missingDeclarations.length })}
              </Text>
            ) : null}

            {snapshot.publicDebt && snapshot.publicDebt.outstanding > 0 ? (
              <Text size="sm" className="text-foreground">
                {t("dashboard.m2m.publicDebt", {
                  amount: formatCurrency(snapshot.publicDebt.outstanding, "HUF"),
                })}
              </Text>
            ) : null}

            <Text
              size="sm"
              className={snapshot.allEndpointsReachable ? "text-green-600" : "text-muted-foreground"}
            >
              {snapshot.allEndpointsReachable ? t("dashboard.m2m.allOk") : t("dashboard.m2m.someFailed")}
            </Text>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
