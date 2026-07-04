// app/(app)/receipts/new.tsx
// Create a receipt with QR code display.
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { generateReceiptNumber } from "@/lib/receipts/numbers";
import type { ReceiptCurrency } from "@/lib/receipts/types";
import type { ReceiptRecord } from "@/lib/receipts/service";
import QRCode from "react-native-qrcode-svg";

const CURRENCIES: ReceiptCurrency[] = ["HUF", "EUR"];

export default function NewReceiptScreen() {
  const { t } = useTranslation();
  const [receiptNumber, setReceiptNumber] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<ReceiptCurrency>("HUF");
  const [created, setCreated] = React.useState<ReceiptRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void apiFetch<{ receipts: ReceiptRecord[] }>("/api/receipts")
      .then((data) => setReceiptNumber(generateReceiptNumber(data.receipts)))
      .catch(() => undefined);
  }, []);

  function resetForm() {
    setCreated(null);
    setClientName("");
    setTotalAmount("");
    setError(null);
    void apiFetch<{ receipts: ReceiptRecord[] }>("/api/receipts")
      .then((data) => setReceiptNumber(generateReceiptNumber(data.receipts)))
      .catch(() => setReceiptNumber(""));
  }

  async function handleCreate() {
    const amount = Number(totalAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("receipts.amountRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ receipt: ReceiptRecord }>("/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          receiptNumber: receiptNumber.trim() || undefined,
          clientName: clientName.trim() || undefined,
          totalAmount: amount,
          currency,
        }),
      });
      setCreated(data.receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("receipts.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function copyQrUrl(url: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return;
    }
  }

  return (
    <FormScreen header={<Heading size="2xl">{t("receipts.new")}</Heading>}>
      <VStack space="md">
        {!created ? (
          <>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("receipts.number")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={receiptNumber} onChangeText={setReceiptNumber} />
              </Input>
            </FormControl>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("receipts.client")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField value={clientName} onChangeText={setClientName} />
              </Input>
            </FormControl>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("receipts.amount")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  keyboardType="decimal-pad"
                />
              </Input>
            </FormControl>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("receipts.currency")}</FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm">
                {CURRENCIES.map((value) => (
                  <Pressable key={value} onPress={() => setCurrency(value)}>
                    <Button size="sm" variant={currency === value ? "default" : "outline"}>
                      <ButtonText>{value}</ButtonText>
                    </Button>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>
            {error ? <Text className="text-destructive">{error}</Text> : null}
            <Button onPress={() => void handleCreate()} disabled={saving}>
              <ButtonText>{saving ? t("common.loading") : t("receipts.create")}</ButtonText>
            </Button>
          </>
        ) : (
          <Card className="items-center p-6">
            <VStack space="md" className="w-full items-center">
              <Text className="text-center font-semibold text-foreground">
                {created.receiptNumber}
              </Text>
              <Text className="text-center text-lg font-bold text-foreground">
                {formatCurrency(created.totalAmount, created.currency)}
              </Text>
              {created.clientName ? (
                <Text size="sm" className="text-muted-foreground">
                  {created.clientName}
                </Text>
              ) : null}
              <QRCode value={created.qrUrl} size={200} />
              <Text size="xs" className="text-center text-muted-foreground">
                {t("receipts.qrHint")}
              </Text>
              <Text size="xs" selectable className="text-center font-mono text-muted-foreground">
                {created.qrUrl}
              </Text>
              <HStack space="sm" className="flex-wrap justify-center">
                <Button
                  variant="outline"
                  onPress={() => void copyQrUrl(created.qrUrl)}
                >
                  <ButtonText>{t("receipts.copyLink")}</ButtonText>
                </Button>
                <Button onPress={() => router.push(routes.receiptDetail(created.id))}>
                  <ButtonText>{t("receipts.viewDetail")}</ButtonText>
                </Button>
                <Button variant="outline" onPress={resetForm}>
                  <ButtonText>{t("receipts.createAnother")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>
        )}
      </VStack>
    </FormScreen>
  );
}
