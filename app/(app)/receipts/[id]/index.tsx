// app/(app)/receipts/[id]/index.tsx
import * as React from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { ReceiptRecord } from "@/lib/receipts/service";
import QRCode from "react-native-qrcode-svg";
import { formatDateWithTime } from "@/lib/dates/format";
import { useRouteParam } from "@/lib/routing/route-param";

export default function ReceiptDetailScreen() {
  const { t } = useTranslation();
  const id = useRouteParam("id");
  const [receipt, setReceipt] = React.useState<ReceiptRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!id) {
      setError(t("receipts.notFound"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ receipt: ReceiptRecord }>(`/api/receipts/${id}`);
      setReceipt(data.receipt);
    } catch (e) {
      setReceipt(null);
      setError(e instanceof Error ? e.message : t("receipts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function copyLink(url: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  if (loading) {
    return (
      <ScreenLayout>
        <ActivityIndicator />
      </ScreenLayout>
    );
  }

  if (!receipt) {
    return (
      <ScreenLayout>
        <VStack space="md">
          <Text className="text-destructive">{error ?? t("receipts.notFound")}</Text>
          <Button variant="outline" onPress={() => void reload()}>
            <ButtonText>{t("common.refresh")}</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            <ButtonText>{t("receipts.back")}</ButtonText>
          </Button>
        </VStack>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={receipt.receiptNumber}
          subtitle={receipt.clientName ?? t("receipts.title")}
        />
      }
    >
      <VStack space="lg">
        <Card className="items-center p-6">
          <VStack space="md" className="items-center">
            <QRCode value={receipt.qrUrl} size={200} />
            <Text size="xs" className="text-center text-muted-foreground">
              {t("receipts.qrHint")}
            </Text>
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="sm">
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                {t("receipts.issued")}
              </Text>
              <Text>{formatDateWithTime(receipt.issuedAt)}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                {t("receipts.amount")}
              </Text>
              <Text className="text-lg font-bold">
                {formatCurrency(receipt.totalAmount, receipt.currency)}
              </Text>
            </HStack>
            {receipt.clientName ? (
              <HStack className="justify-between">
                <Text size="sm" className="text-muted-foreground">
                  {t("receipts.client")}
                </Text>
                <Text>{receipt.clientName}</Text>
              </HStack>
            ) : null}
          </VStack>
        </Card>

        {receipt.lineItems.length > 0 ? (
          <Card className="p-4">
            <VStack space="sm">
              <Heading size="sm">{t("receipts.lineItems")}</Heading>
              {receipt.lineItems.map((li, idx) => (
                <HStack key={idx} className="items-center justify-between border-b border-border pb-2 last:border-b-0">
                  <VStack>
                    <Text size="sm" className="font-medium">{li.description}</Text>
                    <Text size="xs" className="text-muted-foreground">
                      {li.quantity} × {formatCurrency(li.unitPrice, receipt.currency)} ({li.vatRate}% VAT)
                    </Text>
                  </VStack>
                  <Text size="sm" className="font-medium">
                    {formatCurrency(li.quantity * li.unitPrice * (1 + li.vatRate / 100), receipt.currency)}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Card>
        ) : null}

        <Card className="p-4">
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">NAV</Text>
            {receipt.navSubmitted ? (
              <Badge variant="outline" className="rounded-full border-green-500 px-2 py-0.5">
                <BadgeText className="text-xs text-green-600">{t("receipts.navSubmitted")}</BadgeText>
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-2 py-0.5">
                <BadgeText className="text-xs text-muted-foreground">{t("receipts.navPending")}</BadgeText>
              </Badge>
            )}
          </HStack>
        </Card>

        <Text size="xs" selectable className="font-mono text-muted-foreground">
          {receipt.qrUrl}
        </Text>

        <HStack space="sm" className="flex-wrap">
          <Button onPress={() => void Linking.openURL(receipt.qrUrl)}>
            <ButtonText>{t("receipts.openVerify")}</ButtonText>
          </Button>
          <Button variant="outline" onPress={() => void copyLink(receipt.qrUrl)}>
            <ButtonText>{t("receipts.copyLink")}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </ScreenLayout>
  );
}
