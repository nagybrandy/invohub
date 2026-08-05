// app/(app)/receipts/new.tsx
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { Trash2, Plus } from "lucide-react-native";
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
import { createId } from "@/lib/id";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { generateReceiptNumber } from "@/lib/receipts/numbers";
import {
  calculateLineItemTotals,
  type ReceiptLineItemCalcInput,
} from "@/lib/receipts/calculations";
import type { ReceiptRecord } from "@/lib/receipts/service";
import {
  HU_VAT_RATES,
  RECEIPT_PAYMENT_METHODS,
  type ReceiptCurrency,
  type ReceiptPaymentMethod,
} from "@/lib/receipts/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import QRCode from "react-native-qrcode-svg";

type DraftLineItem = ReceiptLineItemCalcInput & { id: string };

const CURRENCIES: ReceiptCurrency[] = ["HUF", "EUR"];

const PAYMENT_METHOD_LABEL_KEYS: Record<ReceiptPaymentMethod, string> = {
  cash: "receipts.paymentMethods.cash",
  card: "receipts.paymentMethods.card",
  transfer: "receipts.paymentMethods.transfer",
  voucher: "receipts.paymentMethods.voucher",
};

function createEmptyLineItem(): DraftLineItem {
  return {
    id: createId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 27,
    unit: "db",
  };
}

type EntryMode = "simple" | "detailed";

export default function NewReceiptScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();

  const [receiptNumber, setReceiptNumber] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [currency, setCurrency] = React.useState<ReceiptCurrency>("HUF");
  const [paymentMethod, setPaymentMethod] = React.useState<ReceiptPaymentMethod>("cash");
  const [entryMode, setEntryMode] = React.useState<EntryMode>("detailed");

  const [totalAmount, setTotalAmount] = React.useState("");
  const [lineItems, setLineItems] = React.useState<DraftLineItem[]>([
    createEmptyLineItem(),
  ]);

  const [created, setCreated] = React.useState<ReceiptRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void apiFetch<{ receipts: ReceiptRecord[] }>("/api/receipts")
      .then((data) => setReceiptNumber(generateReceiptNumber(data.receipts)))
      .catch(() => undefined);
  }, []);

  const totals = React.useMemo(
    () => calculateLineItemTotals(lineItems),
    [lineItems]
  );

  function updateItem(id: string, patch: Partial<DraftLineItem>) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem() {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  }

  function resetForm() {
    setCreated(null);
    setClientName("");
    setTotalAmount("");
    setLineItems([createEmptyLineItem()]);
    setError(null);
    void apiFetch<{ receipts: ReceiptRecord[] }>("/api/receipts")
      .then((data) => setReceiptNumber(generateReceiptNumber(data.receipts)))
      .catch(() => setReceiptNumber(""));
  }

  async function handleCreate() {
    setError(null);

    if (entryMode === "simple") {
      const amount = Number(totalAmount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(t("receipts.amountRequired"));
        return;
      }
    } else {
      if (!lineItems.some((item) => item.description.trim())) {
        setError(t("receipts.lineItemRequired"));
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        receiptNumber: receiptNumber.trim() || undefined,
        clientName: clientName.trim() || undefined,
        currency,
        paymentMethod,
      };

      if (entryMode === "simple") {
        body.totalAmount = Number(totalAmount.replace(",", "."));
      } else {
        body.lineItems = lineItems
          .filter((item) => item.description.trim())
          .map(({ description, quantity, unitPrice, vatRate, unit }) => ({
            description,
            quantity,
            unitPrice,
            vatRate,
            unit,
          }));
      }

      const data = await apiFetch<{ receipt: ReceiptRecord }>("/api/receipts", {
        method: "POST",
        body: JSON.stringify(body),
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
    }
  }

  if (created) {
    return (
      <FormScreen header={<Heading size="2xl">{t("receipts.new")}</Heading>}>
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
              <Button variant="outline" onPress={() => void copyQrUrl(created.qrUrl)}>
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
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<Heading size="2xl">{t("receipts.new")}</Heading>}>
      <VStack space="md">
        <Card className="p-4">
          <VStack space="md">
            <Heading size="md">{t("receipts.details") ?? "Receipt details"}</Heading>

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
                <InputField
                  placeholder={t("receipts.clientOptional")}
                  value={clientName}
                  onChangeText={setClientName}
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("receipts.currency")}</FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm">
                {CURRENCIES.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setCurrency(value)}
                    className={`rounded-md border px-4 py-2 ${
                      currency === value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text size="sm">{value}</Text>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Payment method</FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm" className="flex-wrap">
                {RECEIPT_PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    className={`rounded-md border px-3 py-2 ${
                      paymentMethod === method
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text size="sm">{t(PAYMENT_METHOD_LABEL_KEYS[method])}</Text>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="md">
            <HStack className="items-center justify-between">
              <Heading size="md">Items</Heading>
              <HStack space="xs">
                <Pressable
                  onPress={() => setEntryMode("simple")}
                  className={`rounded-md border px-3 py-1.5 ${
                    entryMode === "simple"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <Text size="xs">Simple</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEntryMode("detailed")}
                  className={`rounded-md border px-3 py-1.5 ${
                    entryMode === "detailed"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background"
                  }`}
                >
                  <Text size="xs">Detailed</Text>
                </Pressable>
              </HStack>
            </HStack>

            {entryMode === "simple" ? (
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("receipts.amount")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="0"
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    keyboardType="decimal-pad"
                  />
                </Input>
              </FormControl>
            ) : (
              <>
                {lineItems.map((item, index) => (
                  <VStack
                    key={item.id}
                    space="sm"
                    className="rounded-lg border border-border p-3"
                  >
                    <HStack className="items-center justify-between">
                      <Text className="font-medium text-foreground">
                        Item {index + 1}
                      </Text>
                      {lineItems.length > 1 ? (
                        <Pressable onPress={() => removeItem(item.id)} className="p-1">
                          <Trash2 size={18} color={icons.muted} />
                        </Pressable>
                      ) : null}
                    </HStack>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>Description</FormControlLabelText>
                      </FormControlLabel>
                      <Input>
                        <InputField
                          placeholder={t("receipts.productPlaceholder")}
                          value={item.description}
                          onChangeText={(v) => updateItem(item.id, { description: v })}
                        />
                      </Input>
                    </FormControl>

                    <HStack space="sm" className="flex-wrap">
                      <FormControl className="min-w-[100px] flex-1">
                        <FormControlLabel>
                          <FormControlLabelText>Net price</FormControlLabelText>
                        </FormControlLabel>
                        <Input>
                          <InputField
                            keyboardType="decimal-pad"
                            value={String(item.unitPrice)}
                            onChangeText={(v) =>
                              updateItem(item.id, {
                                unitPrice: Math.max(0, Number(v) || 0),
                              })
                            }
                          />
                        </Input>
                      </FormControl>

                      <FormControl className="min-w-[70px] flex-1">
                        <FormControlLabel>
                          <FormControlLabelText>Qty</FormControlLabelText>
                        </FormControlLabel>
                        <Input>
                          <InputField
                            keyboardType="decimal-pad"
                            value={String(item.quantity)}
                            onChangeText={(v) =>
                              updateItem(item.id, {
                                quantity: Math.max(0, Number(v) || 0),
                              })
                            }
                          />
                        </Input>
                      </FormControl>

                      <FormControl className="min-w-[60px]">
                        <FormControlLabel>
                          <FormControlLabelText>Unit</FormControlLabelText>
                        </FormControlLabel>
                        <Input>
                          <InputField
                            value={item.unit ?? "db"}
                            onChangeText={(v) => updateItem(item.id, { unit: v })}
                          />
                        </Input>
                      </FormControl>
                    </HStack>

                    <FormControl>
                      <FormControlLabel>
                        <FormControlLabelText>VAT rate</FormControlLabelText>
                      </FormControlLabel>
                      <HStack space="sm">
                        {HU_VAT_RATES.map((rate) => (
                          <Pressable
                            key={rate}
                            onPress={() => updateItem(item.id, { vatRate: rate })}
                            className={`rounded-md border px-3 py-2 ${
                              item.vatRate === rate
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background"
                            }`}
                          >
                            <Text size="sm">{rate}%</Text>
                          </Pressable>
                        ))}
                      </HStack>
                    </FormControl>

                    <Text size="sm" className="text-muted-foreground">
                      Line total:{" "}
                      {formatCurrency(
                        item.quantity * item.unitPrice * (1 + item.vatRate / 100),
                        currency
                      )}
                    </Text>
                  </VStack>
                ))}

                <Button variant="outline" onPress={addItem}>
                  <Plus size={16} color={icons.foreground} />
                  <ButtonText>Add item</ButtonText>
                </Button>
              </>
            )}
          </VStack>
        </Card>

        {entryMode === "detailed" ? (
          <Card className="p-4">
            <VStack space="sm">
              <Heading size="md">Totals</Heading>
              <HStack className="justify-between">
                <Text className="text-muted-foreground">Net total</Text>
                <Text>{formatCurrency(totals.netTotal, currency)}</Text>
              </HStack>
              {totals.vatBreakdown.map((entry) => (
                <HStack key={entry.vatRate} className="justify-between">
                  <Text className="text-muted-foreground">{entry.vatRate}% VAT</Text>
                  <Text>{formatCurrency(entry.vatAmount, currency)}</Text>
                </HStack>
              ))}
              <HStack className="justify-between border-t border-border pt-2">
                <Text className="font-semibold">Gross total</Text>
                <Text className="font-semibold">
                  {formatCurrency(totals.grossTotal, currency)}
                </Text>
              </HStack>
            </VStack>
          </Card>
        ) : null}

        {error ? (
          <Text size="sm" className="text-destructive">
            {error}
          </Text>
        ) : null}

        <Button onPress={() => void handleCreate()} disabled={saving}>
          <ButtonText>
            {saving ? t("common.loading") : t("receipts.create")}
          </ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
