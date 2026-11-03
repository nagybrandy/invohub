// app/receipts/view.tsx
// Public receipt verification page (opened from QR code scan).
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { PublicPage, proseStyles } from "@/components/marketing/PublicPage";
import { Box } from "@/components/ui/box";
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

  // The page speaks the language the receipt was issued in (English or, by
  // default, the viewer's own app language).
  const lng = receipt?.language === "en" ? "en" : undefined;
  const tr = (key: string) => (lng ? t(key, { lng }) : t(key));

  return (
    <PublicPage testID="receipt-verify-page">
      <Box className="mx-auto w-full max-w-[520px] px-4 py-10 tab:px-6 tab:py-14">
        <VStack className="gap-6">
          <VStack className="items-center gap-2">
            <Box className="h-12 w-12 items-center justify-center rounded-card bg-navy">
              <Text className="font-heading text-base font-bold text-white">IH</Text>
            </Box>
            <Heading size="xl" className={`text-center ${proseStyles.h2}`}>
              {tr("receipts.verify.title")}
            </Heading>
            <Text className="text-center text-sm text-muted-ink">
              {tr("receipts.verify.subtitle")}
            </Text>
          </VStack>

          {loading ? <ActivityIndicator /> : null}

          {!loading && error ? (
            <Box className="rounded-card bg-err-wash p-6" accessibilityRole="alert">
              <VStack className="items-center gap-3">
                <XCircle size={36} color={icons.destructive} />
                <Text className="text-center text-sm font-semibold text-err">{error}</Text>
              </VStack>
            </Box>
          ) : null}

          {!loading && receipt ? (
            <Box className="rounded-card bg-surface p-6 shadow-card">
              <VStack className="gap-4">
                <HStack className="items-center justify-center gap-2 rounded-control bg-ok-wash px-3 py-2">
                  <CheckCircle2 size={20} color={icons.ok} />
                  <Text className="text-sm font-semibold text-ok">
                    {tr("receipts.verify.verified")}
                  </Text>
                </HStack>

                <VStack className="gap-3">
                  <Row label={tr("receipts.verify.receiptNumber")} value={receipt.receiptNumber} />
                  <Row label={tr("receipts.verify.issuer")} value={receipt.issuerName} />
                  {receipt.clientName ? (
                    <Row label={tr("receipts.verify.customer")} value={receipt.clientName} />
                  ) : null}
                  <Row
                    label={tr("receipts.verify.amount")}
                    value={formatCurrency(receipt.totalAmount, receipt.currency)}
                    emphasize
                  />
                  <Row
                    label={tr("receipts.issued")}
                    value={formatDateWithTime(receipt.issuedAt)}
                  />
                </VStack>
              </VStack>
            </Box>
          ) : null}
        </VStack>
      </Box>
    </PublicPage>
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
      <Text className="text-sm text-muted-ink">{label}</Text>
      <Text
        className={`max-w-[60%] text-right ${emphasize ? "font-heading text-lg font-bold text-ink" : "text-sm text-ink"}`}
      >
        {value}
      </Text>
    </HStack>
  );
}
