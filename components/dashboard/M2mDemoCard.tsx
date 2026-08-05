// components/dashboard/M2mDemoCard.tsx
// Dashboard card showing a live NAV M2M random test taxpayer snapshot.
import * as React from "react";
import { RefreshCw } from "lucide-react-native";
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
        {ok ? "OK" : code ?? "Failed"}
      </Text>
    </HStack>
  );
}

export function M2mDemoCard() {
  const icons = useIconColors();
  const { snapshot, loading, error, notConfigured, load } = useM2mDemo();

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRefresh() {
    void load(Date.now());
  }

  return (
    <Card className="border-primary/20 bg-primary/5 p-4">
      <VStack space="md">
        <HStack className="items-start justify-between">
          <VStack space="xs" className="flex-1">
            <Text className="font-semibold text-foreground">NAV M2M test user</Text>
            <Text size="sm" className="text-muted-foreground">
              Live snapshot from the official NAV dev test registry.
            </Text>
          </VStack>
          <Button size="sm" variant="outline" onPress={handleRefresh} isDisabled={loading}>
            <RefreshCw size={14} color={icons.muted} />
            <ButtonText className="ml-1">Random</ButtonText>
          </Button>
        </HStack>

        {loading && !snapshot ? <Text size="sm">Loading test user…</Text> : null}

        {notConfigured ? (
          <Text size="sm" className="text-muted-foreground">
            Add M2M_* credentials to `.env` to enable this demo (see `.env.example`).
          </Text>
        ) : null}

        {error && !notConfigured ? (
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
                API checks
              </Text>
              {snapshot.checks.map((check) => (
                <CheckRow
                  key={check.name}
                  label={check.name}
                  ok={check.ok}
                  code={check.resultCode}
                />
              ))}
            </VStack>

            {snapshot.taxSummary ? (
              <HStack space="md" className="flex-wrap">
                <VStack>
                  <Text size="xs" className="text-muted-foreground">
                    Balance
                  </Text>
                  <Text size="sm" className="font-medium">
                    {formatCurrency(snapshot.taxSummary.totalBalance, "HUF")}
                  </Text>
                </VStack>
                <VStack>
                  <Text size="xs" className="text-muted-foreground">
                    Debt
                  </Text>
                  <Text size="sm" className="font-medium">
                    {formatCurrency(snapshot.taxSummary.taxDebt, "HUF")}
                  </Text>
                </VStack>
              </HStack>
            ) : null}

            {snapshot.missingDeclarations.length > 0 ? (
              <Text size="sm" className="text-foreground">
                {snapshot.missingDeclarations.length} missing declaration
                {snapshot.missingDeclarations.length > 1 ? "s" : ""} in test data
              </Text>
            ) : null}

            {snapshot.publicDebt && snapshot.publicDebt.outstanding > 0 ? (
              <Text size="sm" className="text-foreground">
                Public debt: {formatCurrency(snapshot.publicDebt.outstanding, "HUF")}
              </Text>
            ) : null}

            <Text
              size="sm"
              className={snapshot.allEndpointsReachable ? "text-green-600" : "text-muted-foreground"}
            >
              {snapshot.allEndpointsReachable
                ? "All M2M endpoints responded successfully."
                : "Some endpoints returned no data for this test ID (expected for random picks)."}
            </Text>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
