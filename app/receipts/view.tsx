// app/receipts/view.tsx
// Public receipt verification page (opened from QR code scan).
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatCurrency } from "@/lib/invoices/calculations";
import { formatDateWithTime } from "@/lib/dates/format";
import type { PublicReceiptView } from "@/lib/receipts/types";
import { useIconColors } from "@/lib/theme/icon-colors";

export default function PublicReceiptViewScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const { t } = useTranslation();
  const icons = useIconColors();
  const [receipt, setReceipt] = React.useState<PublicReceiptView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const qrToken = Array.isArray(token) ? token[0] : token;

  React.useEffect(() => {
    if (!qrToken?.trim()) {
      setError(t("receipts.verify.missingToken"));
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ token: qrToken.trim() });
    void fetch(`/api/receipts/verify?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          receipt?: PublicReceiptView;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? t("receipts.verify.failed"));
        }
        setReceipt(body.receipt ?? null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t("receipts.verify.failed"));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Box className="flex-1 items-center justify-center px-6 py-8">
        <VStack space="lg" className="w-full max-w-md">
          <VStack space="xs" className="items-center">
            <Box className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Text className="text-xl font-bold text-primary-foreground">IH</Text>
            </Box>
            <Heading size="xl" className="text-center text-foreground">
              {t("receipts.verify.title")}
            </Heading>
            <Text size="sm" className="text-center text-muted-foreground">
              {t("receipts.verify.subtitle")}
            </Text>
          </VStack>

          {loading ? (
            <ActivityIndicator />
          ) : null}

          {!loading && error ? (
            <Card className="border-destructive/30 bg-destructive/5 p-6">
              <VStack space="md" className="items-center">
                <XCircle size={40} color={icons.muted} />
                <Text className="text-center font-semibold text-destructive">{error}</Text>
              </VStack>
            </Card>
          ) : null}

          {!loading && receipt ? (
            <Card className="p-6">
              <VStack space="md">
                <HStack space="sm" className="items-center justify-center">
                  <CheckCircle2 size={22} color={icons.primary} />
                  <Text className="font-semibold text-primary">{t("receipts.verify.verified")}</Text>
                </HStack>

                <VStack space="sm">
                  <Row label={t("receipts.verify.receiptNumber")} value={receipt.receiptNumber} />
                  <Row label={t("receipts.verify.issuer")} value={receipt.issuerName} />
                  {receipt.clientName ? (
                    <Row label={t("receipts.verify.customer")} value={receipt.clientName} />
                  ) : null}
                  <Row
                    label={t("receipts.verify.amount")}
                    value={formatCurrency(receipt.totalAmount, receipt.currency)}
                    emphasize
                  />
                  <Row
                    label={t("receipts.issued")}
                    value={formatDateWithTime(receipt.issuedAt)}
                  />
                </VStack>
              </VStack>
            </Card>
          ) : null}
        </VStack>
      </Box>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <HStack className="items-start justify-between gap-4">
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
      <Text
        size="sm"
        className={`max-w-[60%] text-right ${emphasize ? "text-lg font-bold text-foreground" : "text-foreground"}`}
      >
        {value}
      </Text>
    </HStack>
  );
}
