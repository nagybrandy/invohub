// app/(app)/receipts/[id]/index.tsx
// Receipt detail with QR code and verification link.
import * as React from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { ReceiptRecord } from "@/lib/receipts/service";
import QRCode from "react-native-qrcode-svg";

export default function ReceiptDetailScreen() {
  const { t } = useTranslation();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
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
              <Text>{new Date(receipt.issuedAt).toLocaleString()}</Text>
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
